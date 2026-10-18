import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, sh, readJSON, writeJSON, hash } from '../util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCANNER = path.join(HERE, 'go', 'ph_targets.go');
const RAPID = 'pgregory.net/rapid@v1.3.0';
const TARGET_FILE = 'ph-target.json';

function goEnv(cfg) {
  // Workspace mode forbids -modfile; counterhound always tests one module at a time.
  return { ...process.env, ...(cfg.env || {}), GOWORK: 'off', GOFLAGS: '', GOTOOLCHAIN: process.env.GOTOOLCHAIN || 'local' };
}

/** Nearest directory at or above `dir` that has a go.mod. */
function moduleDir(dir, repo) {
  for (let d = dir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'go.mod'))) return d;
    if (d === path.dirname(d) || !d.startsWith(repo)) return repo;
  }
}

/**
 * A private copy of the module's go.mod (plus rapid), used with `go test -modfile`, so the
 * project's own go.mod and go.sum are never touched.
 */
function ensureModfile(repo, modDir, cfg) {
  const dir = path.join(repo, '.counterhound', 'go', hash(modDir, 8));
  const mod = path.join(dir, 'go.mod');
  const src = path.join(modDir, 'go.mod');
  const stamp = path.join(dir, 'source.txt');
  const want = `${src}:${fs.existsSync(src) ? fs.statSync(src).mtimeMs : 0}`;
  if (fs.existsSync(mod) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === want) return mod;
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, mod);
  const sum = path.join(modDir, 'go.sum');
  if (fs.existsSync(sum)) fs.copyFileSync(sum, path.join(dir, 'go.sum'));
  else fs.rmSync(path.join(dir, 'go.sum'), { force: true });
  const r = sh('go', ['get', `-modfile=${mod}`, RAPID], { cwd: modDir, env: goEnv(cfg) });
  fs.writeFileSync(path.join(dir, 'rapid.txt'), r.code === 0 ? 'ok' : r.stderr);
  fs.writeFileSync(stamp, want);
  return mod;
}

/** Which package a test file in a work dir belongs to: hunt writes ph-target.json next to it. */
function packageFor(repo, file) {
  const t = readJSON(path.join(path.dirname(file), TARGET_FILE), null);
  if (t?.pkgDir) return path.join(repo, t.pkgDir);
  const pkg = (fs.readFileSync(file, 'utf8').match(/^package\s+(\w+)/m) || [])[1];
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.isFile() && e.name.endsWith('.go') && !e.name.endsWith('_test.go')
      && new RegExp(`^package\\s+${pkg}\\b`, 'm').test(fs.readFileSync(path.join(dir, e.name), 'utf8')))) found.push(dir);
    if (depth > 0) for (const e of entries) if (e.isDirectory() && !/^[._]|^(vendor|testdata|node_modules)$/.test(e.name)) walk(path.join(dir, e.name), depth - 1);
  };
  if (pkg) walk(repo, 5);
  return found[0] || repo;
}

const virtualName = (file) => `zz_counterhound_${path.basename(file).replace(/(_test)?\.go$/, '')}_test.go`;

function testNames(file) {
  return [...fs.readFileSync(file, 'utf8').matchAll(/^func\s+(Test\w*)\s*\(\s*\w+\s+\*testing\.T\s*\)/gm)].map((m) => m[1]);
}

function sourceLine(file, line) {
  try { return fs.readFileSync(file, 'utf8').split('\n')[line - 1] || ''; } catch { return ''; }
}

/** Turn one failed test's output into counterhound's error shape. `remap` maps virtual paths to work files. */
export function parseGoFailure(lines, remap) {
  const fix = (f) => remap.get(f) || remap.get(path.basename(f)) || f;
  const frame = (file, line, func) => { const f = fix(file); return { file: f, line: +line, func, code: sourceLine(f, +line).trim().slice(0, 300) }; };
  const text = lines.join('');
  const out = { type: null, message: '', notes: [], frames: [], example: null };
  const draws = [...text.matchAll(/\[rapid\] draw (.*)$/gm)].map((m) => m[1].trim());
  if (draws.length) out.example = `Failing test case: ${draws.join(', ')}`;

  let m;
  if ((m = text.match(/\[rapid\] panic after \d+ tests?: (.*)$/m))) {
    // rapid recovers panics and prints its own traceback, deepest frame first.
    out.message = m[1].trim();
    const tb = text.slice(m.index).split(/\n\s*Failed test output:/)[0];
    for (const f of tb.matchAll(/^\s+(\/\S+\.go):(\d+) in (\S+)$/gm)) out.frames.push(frame(f[1], f[2], f[3]));
    out.frames.reverse();
  } else if ((m = text.match(/^(?:panic|fatal error): (.*?)(?: \[recovered\])?$/m))) {
    out.message = m[1].trim();
    if (/^test timed out/.test(out.message)) out.type = 'GoTestTimeout';
    // Goroutine trace: "pkg.Func(args)" then "\t/abs/file.go:12 +0x1f", deepest frame first.
    const trace = text.slice(m.index).split(/\ngoroutine \d+ \[/).slice(1, 2).join('');
    for (const f of trace.matchAll(/^(\S.*?)\(.*\)\n\t(\/\S+?\.go):(\d+)/gm)) out.frames.push(frame(f[2], f[3], f[1]));
    // frames above the last panic() call are testing's recover-and-repanic machinery
    const p = out.frames.map((f) => f.func).lastIndexOf('panic');
    if (p >= 0) out.frames = out.frames.slice(p + 1);
    out.frames.reverse();
  }
  if (out.message) {
    out.type ||= /^runtime error|^assignment to entry in nil map|^close of (nil|closed) channel|^all goroutines are asleep|stack overflow|stack exceeds/.test(out.message)
      ? 'runtime.Error' : 'panic';
    if (/^\[rapid\] failed/.test(out.message)) out.type = 'AssertionError';
    return out;
  }
  // t.Error / t.Fatal: "    file_test.go:14: message" (rapid: "[rapid] failed after 3 tests: message").
  const msgs = [];
  let site = null;
  for (const raw of lines) {
    const l = raw.replace(/\n$/, '');
    const t = l.match(/^\s{4}(\S+\.go):(\d+): (.*)$/);
    if (t && !/^\[rapid\] draw /.test(t[3])) {
      msgs.push(t[3].replace(/^\[rapid\] failed after \d+ tests?: /, ''));
      site ||= frame(t[1], t[2], '');
    } else if (msgs.length && /^\s{8}\S/.test(l) && !/To reproduce, specify|Failed test output:/.test(l)) {
      msgs[msgs.length - 1] += '\n' + l.trim();
    }
  }
  out.type = 'AssertionError';
  out.message = [...new Set(msgs)].filter((x) => !/^\s*$/.test(x)).join('\n').slice(0, 2000) || 'test failed';
  if (site) out.frames = [site];
  return out;
}

export function parseGoJson(stdout, remap) {
  const tests = new Map();
  const build = [];
  let pkgFailOutput = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.Action === 'build-output') { build.push(e.Output); continue; }
    if (!e.Test) { if (e.Action === 'output') pkgFailOutput.push(e.Output); continue; }
    const name = e.Test.split('/')[0];
    if (!tests.has(name)) tests.set(name, { name, outcome: null, lines: [] });
    const t = tests.get(name);
    if (e.Test !== name && e.Action !== 'output') continue; // subtest status: the parent decides
    if (e.Action === 'output') t.lines.push(e.Output);
    else if (e.Action === 'pass') t.outcome = 'passed';
    else if (e.Action === 'fail') t.outcome = 'failed';
    else if (e.Action === 'skip') t.outcome = 'skipped';
  }
  const out = [];
  for (const t of tests.values()) {
    const unfinished = !t.outcome;
    if (unfinished) t.outcome = 'failed'; // the binary died while this test was running
    out.push({
      id: t.name, name: t.name, outcome: t.outcome,
      error: t.outcome === 'failed' ? parseGoFailure(t.lines, remap) : null,
      longrepr: t.outcome === 'failed' ? t.lines.join('').slice(-6000) : null,
    });
    // a panic printed after the test's own lines lands in package output
    if (unfinished && !t.lines.join('').includes('panic:') && pkgFailOutput.join('').includes('panic:')) {
      out[out.length - 1].error = parseGoFailure([...t.lines, ...pkgFailOutput], remap);
    }
  }
  return { tests: out, build: build.join('') };
}

export const go = {
  id: 'go',
  name: 'Go',
  framework: 'rapid',
  ext: '_test.go',

  detect(repo) { return fs.existsSync(path.join(repo, 'go.mod')); },

  check(repo, cfg = {}) {
    const r = sh('go', ['version'], { cwd: repo });
    if (r.code !== 0) return { ok: false, problem: 'the go command was not found. Install Go 1.21+ from https://go.dev/dl/' };
    return { ok: true, info: `${r.stdout.trim().replace(/^go version /, '')}, rapid ${RAPID.split('@')[1]} (fetched into a private go.mod copy)` };
  },

  prepare(repo, workRoot, cfg = {}) {
    ensureModfile(repo, moduleDir(repo, repo), cfg);
  },

  /** Called once per hunted module: record which package the work dir's tests belong to. */
  prepareGroup(repo, group, workdir, cfg = {}) {
    const f = group.functions[0];
    writeJSON(path.join(workdir, TARGET_FILE), { pkgDir: f.pkgDir, pkgName: f.pkgName, importPath: f.module });
    ensureModfile(repo, moduleDir(path.join(repo, f.pkgDir), repo), cfg);
  },

  listTargets(repo, cfg, only = []) {
    const r = sh('go', ['run', SCANNER, path.resolve(repo), ...only], { cwd: os.tmpdir(), env: { ...goEnv(cfg), GO111MODULE: 'on', GOFLAGS: '-mod=mod' } });
    if (r.code !== 0) throw new Error(`target scan failed: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
    return JSON.parse(r.stdout).map((t) => ({ ...t, decorators: [], lang: 'go', id: `${t.module}.${t.qualname}` }));
  },

  importHint(target) {
    return `package ${target.pkgName} (tests are compiled into the package, so call ${target.owner ? `(${target.owner}).${target.name}` : target.name} directly; import path ${target.module})`;
  },

  needsTs() { return false; },

  files() { return { props: 'ph_props_test.go', repro: 'repro_<name>_test.go' }; },

  /**
   * Compile the given test files into their package with `go test -overlay` (nothing is
   * written to the project) and run only the tests they define.
   */
  async runTests(repo, cfg, selectors, { timeoutMs = 300000, name, maxExamples } = {}) {
    const files = selectors.map((s) => path.resolve(s)).filter((f) => fs.existsSync(f));
    if (!files.length) return { code: 1, timedOut: false, ms: 0, tests: [], output: `no such file: ${selectors.join(' ')}` };
    const pkgDir = packageFor(repo, files[0]);
    const modDir = moduleDir(pkgDir, repo);
    const modfile = ensureModfile(repo, modDir, cfg);
    const replace = {};
    const remap = new Map();
    for (const f of files) {
      const virt = path.join(pkgDir, virtualName(f));
      replace[virt] = f;
      remap.set(virt, f);
      remap.set(path.basename(virt), f);
    }
    const overlay = path.join(os.tmpdir(), `ph-overlay-${process.pid}-${hash(files.join(' ') + Math.random(), 8)}.json`);
    fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
    const names = name ? [name] : [...new Set(files.flatMap(testNames))];
    const usesRapid = files.some((f) => /"pgregory\.net\/rapid"/.test(fs.readFileSync(f, 'utf8')));
    const rel = path.relative(modDir, pkgDir).split(path.sep).join('/');
    const args = ['test', '-json', '-count=1', '-mod=mod', `-modfile=${modfile}`, `-overlay=${overlay}`,
      `-timeout=${Math.max(10, Math.round(timeoutMs / 1000) - 5)}s`, `-run=^(${names.length ? names.join('|') : 'NONE'})$`, rel ? `./${rel}` : '.'];
    if (usesRapid) args.push('-args', '-rapid.nofailfile', `-rapid.checks=${maxExamples || cfg.maxExamples || 300}`);
    const r = await run('go', args, { cwd: modDir, env: goEnv(cfg), timeoutMs });
    fs.rmSync(overlay, { force: true });
    const { tests, build } = parseGoJson(r.stdout, remap);
    let detail = build || r.stderr;
    for (const [virt, f] of remap) detail = detail.split(virt).join(path.relative(repo, f));
    if (!tests.length && r.code !== 0) {
      tests.push({ id: 'build', name: 'build', outcome: 'error', error: null, longrepr: detail.trim().slice(-4000) || 'go test failed' });
    }
    return { code: r.code, timedOut: r.timedOut, ms: r.ms, tests, output: `${detail}\n${r.stdout.split('\n').filter((l) => !l.startsWith('{')).join('\n')}` };
  },

  suite(repo, cfg = {}) {
    return { cmd: 'go', args: ['test', '-count=1', './...'], cwd: moduleDir(repo, repo), env: { GOWORK: 'off', GOFLAGS: '-mod=mod' } };
  },

  testErrorTypes: ['GoTestTimeout'],

  isExplicitRaise(frame) { return /(^|[;{]\s*)(panic\(|log\.(Fatal|Panic))/.test(frame?.code || ''); },
};
