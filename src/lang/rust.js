import fs from 'node:fs';
import path from 'node:path';
import { run, sh, readJSON, writeJSON, hash } from '../util.js';

const TARGET_FILE = 'ph-target.json';
const SKIP_DIRS = new Set(['target', '.git', 'node_modules', 'vendor', '.proofhound', 'tests', 'benches', 'examples', 'fuzz', 'bin']);

// --- Cargo.toml (just enough TOML to find the package and its library) ---

function tomlSection(src, name) {
  const m = src.match(new RegExp(`^\\[${name.replace('.', '\\.')}\\]\\s*$([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, 'm'));
  return m ? m[1] : null;
}
function tomlString(section, key) {
  const m = section && section.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return m ? m[1] : null;
}

/** { name, libName, edition, libPath } for a crate dir with a library target, else null. */
export function crateInfo(dir) {
  let src;
  try { src = fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf8'); } catch { return null; }
  const pkg = tomlSection(src, 'package');
  if (!pkg) return null;
  const name = tomlString(pkg, 'name');
  const lib = tomlSection(src, 'lib');
  const libPath = tomlString(lib, 'path') || 'src/lib.rs';
  if (!name || !fs.existsSync(path.join(dir, libPath))) return null;
  let edition = tomlString(pkg, 'edition');
  if (!edition && /edition\.workspace\s*=\s*true/.test(pkg)) edition = '2021';
  return { name, libName: (tomlString(lib, 'name') || name).replace(/-/g, '_'), edition: edition || '2015', libPath };
}

function findCrates(repo) {
  const out = [];
  const walk = (dir, depth) => {
    if (crateInfo(dir)) out.push(dir);
    if (depth <= 0) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name) && e.name !== 'src') walk(path.join(dir, e.name), depth - 1);
  };
  walk(repo, 3);
  return out;
}

// --- scanning `pub fn` items ---

const strip = (l) => l.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])'/g, "' '").replace(/\/\/.*$/, '');
const IMPURE = /\b(std::fs|fs::|std::net|TcpStream|std::env|env::var|Instant::now|SystemTime|rand::|thread::|std::process|Command::new|println!|eprintln!|File::)/g;
const TRAIT_FNS = new Set(['from_str', 'try_from', 'from', 'cmp', 'partial_cmp', 'eq']);

function docBefore(lines, i) {
  const doc = [];
  for (let j = i - 1; j >= 0; j--) {
    const t = lines[j].trim();
    if (t.startsWith('///')) doc.unshift(t.replace(/^\/\/\/\s?/, ''));
    else if (t.startsWith('#[') || t === '') { if (doc.length && t === '') break; }
    else break;
  }
  return doc.join('\n').trim();
}

/** Module path of a source file relative to the crate's src dir: lib.rs -> [], a/b.rs -> [a, b], a/mod.rs -> [a]. */
function modSegments(srcDir, file) {
  const rel = path.relative(srcDir, file).split(path.sep);
  const last = rel.pop().replace(/\.rs$/, '');
  if (last !== 'mod' && last !== 'lib') rel.push(last);
  return rel;
}

/** Is every module on the path declared `pub mod`? */
function modulePublic(srcDir, segs, libPath) {
  let parent = path.join(srcDir, path.basename(libPath));
  let dir = srcDir;
  for (const seg of segs) {
    let src = '';
    try { src = fs.readFileSync(parent, 'utf8'); } catch { return false; }
    if (!new RegExp(`^\\s*pub\\s+mod\\s+${seg}\\s*;`, 'm').test(src)) return false;
    dir = path.join(dir, seg);
    parent = fs.existsSync(path.join(dir, 'mod.rs')) ? path.join(dir, 'mod.rs') : `${dir}.rs`;
  }
  return true;
}

export function scanRustFile(repo, crateDir, info, file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.length > 400000) return [];
  const lines = src.split('\n');
  const srcDir = path.dirname(path.join(crateDir, info.libPath));
  const segs = modSegments(srcDir, file);
  const libSrc = fs.readFileSync(path.join(crateDir, info.libPath), 'utf8');
  const isPublic = modulePublic(srcDir, segs, info.libPath);
  const modulePath = [info.libName, ...segs].join('::');
  const rel = path.relative(repo, file).split(path.sep).join('/');
  const out = [];
  let depth = 0;
  const impls = []; // { type, trait, depth }
  let skipDepth = null; // inside #[cfg(test)] mod
  let pendingCfgTest = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (/^#\[cfg\(test\)\]/.test(t)) pendingCfgTest = true;
    else if (pendingCfgTest && /^(pub\s+)?mod\s+\w+\s*\{/.test(t)) { skipDepth = depth; pendingCfgTest = false; }
    else if (t && !t.startsWith('#[') && !t.startsWith('//')) pendingCfgTest = false;
    const im = skipDepth == null && t.match(/^impl\b(?:\s*<.*?>)?\s+(?:([\w:]+)(?:<.*?>)?\s+for\s+)?([\w:]+)/);
    const fm = skipDepth == null && t.match(/^(pub(?:\((crate|super|in [^)]*)\))?\s+)?(const\s+)?(async\s+)?(unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+(\w+)/);
    const before = depth;
    for (const ch of strip(line)) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (im) impls.push({ type: im[2].split('::').pop(), trait: im[1] ? im[1].split('::').pop() : null, depth: before });
    while (impls.length && depth <= impls[impls.length - 1].depth) impls.pop();
    if (skipDepth != null && depth <= skipDepth) { skipDepth = null; continue; }
    if (!fm) continue;
    const [, pub, restricted, , isAsync, isUnsafe, name] = fm;
    const impl = impls.find((x) => x.depth === before - 1) || null;
    const topLevel = before === 0;
    if (!topLevel && !impl) continue; // nested or inside a trait definition
    if (isUnsafe || restricted || name.startsWith('_')) continue;
    if (impl?.trait ? !TRAIT_FNS.has(name) : !pub) continue;
    if (!isPublic && !new RegExp(`pub\\s+use\\b[^;]*\\b${impl ? impl.type : name}\\b`).test(libSrc)) continue;
    // signature: up to the opening brace (may span lines)
    let sig = '', j = i;
    for (; j < Math.min(lines.length, i + 30); j++) { sig += ' ' + lines[j].trim(); if (/\{|;\s*$/.test(lines[j])) break; }
    if (/;\s*$/.test(sig) && !sig.includes('{')) continue; // no body
    sig = sig.replace(/\{.*$/, '').replace(/\s+/g, ' ').trim();
    // body extent
    let d = 0, seen = false, end = i;
    for (let k = i; k < Math.min(lines.length, i + 800); k++) {
      for (const ch of strip(lines[k])) { if (ch === '{') { d++; seen = true; } else if (ch === '}') d--; }
      if (seen && d <= 0) { end = k; break; }
    }
    const body = lines.slice(i, end + 1).join('\n');
    const open = sig.indexOf('(');
    let pd = 0, close = open;
    for (; close < sig.length; close++) { if (sig[close] === '(') pd++; else if (sig[close] === ')' && --pd === 0) break; }
    const params = sig.slice(open + 1, close).replace(/<[^<>]*>/g, '').replace(/\([^()]*\)/g, '');
    const nArgs = params.split(',').map((s) => s.trim()).filter((s) => s && !/^&?('\w+\s+)?(mut\s+)?self$/.test(s)).length;
    const owner = impl ? impl.type : null;
    const qualname = owner ? `${owner}::${name}` : name;
    out.push({
      file: rel, module: modulePath, crateDir: path.relative(repo, crateDir).split(path.sep).join('/') || '.', crateName: info.name, libName: info.libName,
      name, qualname, owner, trait: impl?.trait || null, publicModule: isPublic, line: i + 1, loc: end - i + 1,
      signature: sig.replace(/^.*?fn\s+\w+/, ''), nArgs, doc: docBefore(lines, i).slice(0, 600), async: Boolean(isAsync),
      impure: [...new Set([...body.matchAll(IMPURE)].map((x) => x[1].replace(/::$/, '')))], annotated: true, decorators: [],
    });
  }
  return out;
}

// --- running tests through a throwaway harness crate ---

function sourceLine(file, line) {
  try { return fs.readFileSync(file, 'utf8').split('\n')[line - 1] || ''; } catch { return ''; }
}

const isStd = (f) => /^\/rustc\/|[/\\]\.rustup[/\\]|[/\\]library[/\\](core|std|alloc)[/\\]/.test(f);

/** Parse one "---- name stdout ----" section into proofhound's error shape. */
export function parseRustFailure(section, workdir) {
  const inWork = (f) => workdir && path.resolve(f).startsWith(path.resolve(workdir) + path.sep);
  const blocks = section.split(/^(?=thread '[^']*'(?: \(\d+\))? panicked at )/m).filter((b) => b.startsWith('thread '));
  const parsed = blocks.map((b) => {
    const m = b.match(/^thread '[^']*'(?: \(\d+\))? panicked at (.+?):(\d+):(\d+):\n([\s\S]*?)(?=\nstack backtrace:|\nnote: |\n*$)/);
    if (!m) return null;
    const frames = [];
    const bt = b.split(/\nstack backtrace:\n/)[1] || '';
    for (const f of bt.matchAll(/^\s+\d+: (.+)\n\s+at (.+?):(\d+):(\d+)$/gm)) frames.push({ file: f[2], line: +f[3], func: f[1].trim(), code: '' });
    // deepest first; drop the panic machinery inside std/core
    while (frames.length && isStd(frames[0].file)) frames.shift();
    frames.reverse();
    const loc = { file: m[1], line: +m[2], func: '', code: '' };
    if (!frames.length && !isStd(loc.file)) frames.push(loc);
    for (const f of frames) if (!isStd(f.file)) f.code = sourceLine(f.file, f.line).trim().slice(0, 300);
    return { loc, message: m[4].trim(), frames };
  }).filter(Boolean);
  const out = { type: 'panic', message: '', notes: [], frames: [], example: null };
  const ex = section.match(/minimal failing input: ([\s\S]*?)\n\s*successes:/);
  if (ex) out.example = `Failing test case: ${ex[1].replace(/\s+/g, ' ').trim()}`;
  if (!parsed.length) {
    out.message = /overflowed its stack/.test(section) ? 'stack overflow' : section.trim().split('\n').slice(-5).join('\n');
    return out;
  }
  let last = parsed[parsed.length - 1];
  // proptest catches a panic from the code under test, shrinks, then panics again in the test
  // with "Test failed: ...". The last panic raised outside the test is the real one.
  if (/^Test failed:/.test(last.message)) {
    const inner = parsed.slice(0, -1).reverse().find((p) => !inWork(p.loc.file) && !isStd(p.loc.file) || p.frames.some((f) => !inWork(f.file) && !isStd(f.file)));
    if (inner && !/^Test failed:/.test(inner.message) && !/^assertion/.test(inner.message)) last = { ...inner, message: inner.message };
  }
  out.message = last.message.slice(0, 2000);
  out.frames = last.frames;
  const deepest = last.frames[last.frames.length - 1];
  const raisedInTest = (deepest && inWork(deepest.file)) || inWork(last.loc.file);
  // A failed assert!/assert_eq!/prop_assert!, or unwrap() on the code's result, in the test means a wrong result.
  if (/^(assertion|Test failed:)/.test(last.message) || (raisedInTest && /^called `(Result|Option)::unwrap\(\)`/.test(last.message))) out.type = 'AssertionError';
  return out;
}

export function parseLibtest(stdout, workdir) {
  const tests = [];
  const sections = new Map();
  const parts = stdout.split(/^---- (\S+) stdout ----$/m);
  for (let i = 1; i < parts.length; i += 2) sections.set(parts[i], parts[i + 1].split(/^\nfailures:\n/m)[0]);
  const lines = [...stdout.matchAll(/^test (\S+) \.\.\. ?(ok|FAILED|ignored.*)?$/gm)];
  for (const m of lines) {
    const name = m[1];
    const res = m[2] || 'crashed';
    const outcome = res === 'ok' ? 'passed' : res.startsWith('ignored') ? 'skipped' : 'failed';
    const section = sections.get(name) || (res === 'crashed' ? 'thread overflowed its stack or aborted' : '');
    tests.push({ id: name, name: name.split('::').pop(), outcome, error: outcome === 'failed' ? parseRustFailure(section, workdir) : null, longrepr: outcome === 'failed' ? section.slice(-6000) : null });
  }
  return tests;
}

function harnessToml({ crate, crateDir, edition, files, proptest, features }) {
  const dep = `${JSON.stringify(crate)} = { path = ${JSON.stringify(crateDir)}${features?.length ? `, features = ${JSON.stringify(features)}` : ''} }`;
  return `# Generated by proofhound; safe to delete.
[package]
name = "proofhound-harness"
version = "0.0.0"
edition = "${edition === '2015' ? '2018' : edition}"
publish = false
autotests = false
autobins = false
autoexamples = false
autobenches = false

[workspace]

[lib]
path = "lib.rs"

[dependencies]
${dep}
${proptest ? 'proptest = "1"\n' : ''}
${files.map((f) => `[[test]]\nname = ${JSON.stringify(f.target)}\npath = ${JSON.stringify(f.file)}\n`).join('\n')}`;
}

/** The crate a work dir's tests target: hunt writes ph-target.json; otherwise the repo's first library crate. */
function crateFor(repo, file) {
  const t = readJSON(path.join(path.dirname(file), TARGET_FILE), null);
  if (t?.crateDir) return path.resolve(repo, t.crateDir);
  return findCrates(repo)[0] || repo;
}

function lockfileFor(crateDir, repo) {
  for (let d = crateDir; d.startsWith(repo); d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'Cargo.lock'))) return path.join(d, 'Cargo.lock');
    if (d === path.dirname(d)) break;
  }
  return null;
}

export const rust = {
  id: 'rust',
  name: 'Rust',
  framework: 'proptest',
  ext: '.rs',

  detect(repo) { return fs.existsSync(path.join(repo, 'Cargo.toml')); },

  check(repo) {
    const r = sh('cargo', ['--version'], { cwd: repo });
    if (r.code !== 0) return { ok: false, problem: 'cargo was not found. Install Rust from https://rustup.rs' };
    if (!findCrates(repo).length) return { ok: false, problem: 'no library crate found (proofhound tests a crate\'s public library API)' };
    return { ok: true, info: `${r.stdout.trim()}, proptest 1.x (fetched into a separate harness crate)` };
  },

  prepareGroup(repo, group, workdir) {
    const f = group.functions[0];
    writeJSON(path.join(workdir, TARGET_FILE), { crateDir: f.crateDir, crate: f.crateName, libName: f.libName });
  },

  listTargets(repo, cfg, only = []) {
    const out = [];
    const onlyAbs = only.map((o) => path.resolve(repo, o));
    for (const crateDir of findCrates(repo)) {
      const info = crateInfo(crateDir);
      const srcDir = path.dirname(path.join(crateDir, info.libPath));
      const files = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p); }
          else if (e.name.endsWith('.rs') && e.name !== 'main.rs' && e.name !== 'build.rs' && !/(^|_)tests?\.rs$/.test(e.name)) files.push(p);
        }
      };
      walk(srcDir);
      for (const f of files) {
        if (onlyAbs.length && !onlyAbs.some((o) => f === o || f.startsWith(o + path.sep))) continue;
        out.push(...scanRustFile(repo, crateDir, info, f));
      }
    }
    return out.map((t) => ({ ...t, entry: t.publicModule && t.module === t.libName, lang: 'rust', id: `${t.module}::${t.qualname}` }));
  },

  importHint(target) {
    if (target.publicModule) return `use ${target.module}::${target.owner || target.name};`;
    return `use ${target.libName}::${target.owner || target.name}; (re-exported at the crate root)`;
  },

  needsTs() { return false; },

  files() { return { props: 'ph_props.rs', repro: 'repro_<name>.rs' }; },

  /**
   * Each test file becomes an integration test of a throwaway harness crate that depends on
   * the project by path, so only the crate's public API is used and nothing in it is touched.
   */
  async runTests(repo, cfg, selectors, { timeoutMs = 600000, name, maxExamples } = {}) {
    const files = selectors.map((s) => path.resolve(s)).filter((f) => fs.existsSync(f));
    if (!files.length) return { code: 1, timedOut: false, ms: 0, tests: [], output: `no such file: ${selectors.join(' ')}` };
    const crateDir = crateFor(repo, files[0]);
    const info = crateInfo(crateDir);
    if (!info) return { code: 1, timedOut: false, ms: 0, tests: [{ id: 'build', name: 'build', outcome: 'error', error: null, longrepr: `no library crate at ${crateDir}` }], output: '' };
    const workdir = path.dirname(files[0]);
    const home = path.join(repo, '.proofhound', 'rust');
    const hdir = path.join(home, `h-${hash(workdir, 10)}`);
    fs.mkdirSync(hdir, { recursive: true });
    if (!fs.existsSync(path.join(hdir, 'lib.rs'))) fs.writeFileSync(path.join(hdir, 'lib.rs'), '');
    const lock = lockfileFor(crateDir, repo);
    if (lock && !fs.existsSync(path.join(hdir, 'Cargo.lock'))) fs.copyFileSync(lock, path.join(hdir, 'Cargo.lock'));
    const entries = files.map((f) => ({ file: f, target: `ph_${path.basename(f, '.rs').replace(/\W/g, '_')}` }));
    const proptest = files.some((f) => /\bproptest\b/.test(fs.readFileSync(f, 'utf8')));
    fs.writeFileSync(path.join(hdir, 'Cargo.toml'), harnessToml({ crate: info.name, crateDir, edition: info.edition, files: entries, proptest, features: cfg.features }));
    const args = ['test', '--color', 'never', '--manifest-path', path.join(hdir, 'Cargo.toml'), ...entries.flatMap((e) => ['--test', e.target]), '--', '--test-threads=1', '--color', 'never'];
    if (name) args.push(name);
    const env = {
      ...process.env, ...(cfg.env || {}), CARGO_TARGET_DIR: path.join(home, 'target'), RUST_BACKTRACE: '1', CARGO_TERM_COLOR: 'never',
      PROPTEST_CASES: String(maxExamples || cfg.maxExamples || 256),
    };
    const r = await run('cargo', args, { cwd: hdir, env, timeoutMs });
    const tests = parseLibtest(r.stdout, workdir);
    if (!tests.length && r.code !== 0) {
      // compile errors: keep the error blocks, which name the test file and line
      const errs = r.stderr.split(/\n(?=error|warning)/).filter((b) => /^error/.test(b) && !/^error: (could not compile|test failed)/.test(b));
      tests.push({ id: 'build', name: 'build', outcome: 'error', error: null, longrepr: (errs.join('\n').trim() || r.stderr.trim()).slice(0, 6000) });
    }
    return { code: r.code, timedOut: r.timedOut, ms: r.ms, tests, output: `${r.stdout}\n${r.stderr}` };
  },

  // the first build of the harness compiles the crate and proptest
  testTimeoutSec: 900,

  testErrorTypes: [],

  isExplicitRaise(frame) { return /^\s*(panic!|unreachable!|unimplemented!|todo!|assert(_eq|_ne)?!)/.test(frame?.code || ''); },
};
