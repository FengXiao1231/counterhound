// --fix: for each confirmed bug, an agent edits a sandbox copy of the project. proofhound keeps the
// patch only if the bug's repro now passes and the project's own test suite is no worse than before.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, sh, writeFile, log, c, pool } from './util.js';
import { fixerPrompt } from './prompts.js';
import { writeTestWrapper } from './hunt.js';

// Directories that are linked into the sandbox rather than copied: large, and never part of a fix.
const LINK = new Set(['node_modules', '.venv', 'venv', 'env']);
const SKIP = new Set(['.git', '.proofhound', 'target', 'build', '.gradle', '__pycache__', '.pytest_cache', '.mypy_cache', '.idea', '.tox', 'dist', 'coverage']);
const MAX_BYTES = 300 * 1024 * 1024;

/** Copy the project into `dest`, linking heavy dependency folders. Returns false if it is too big. */
export function makeSandbox(repo, dest) {
  let bytes = 0;
  const copy = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name), b = path.join(to, e.name);
      if (e.isDirectory()) {
        if (LINK.has(e.name)) fs.symlinkSync(a, b, 'dir');
        else if (!SKIP.has(e.name)) copy(a, b);
      } else if (e.isFile()) {
        bytes += fs.statSync(a).size;
        if (bytes > MAX_BYTES) throw new Error('project is too large to copy for --fix');
        fs.copyFileSync(a, b);
      } else if (e.isSymbolicLink()) {
        fs.symlinkSync(fs.readlinkSync(a), b);
      }
    }
  };
  copy(repo, dest);
  const cfg = path.join(repo, '.proofhound', 'config.json');
  if (fs.existsSync(cfg)) { fs.mkdirSync(path.join(dest, '.proofhound'), { recursive: true }); fs.copyFileSync(cfg, path.join(dest, '.proofhound', 'config.json')); }
}

/** Files that differ between the sandbox and the project (repo-relative), skipping linked and generated dirs. */
export function changedFiles(repo, sandbox) {
  const out = [];
  const walk = (rel) => {
    const dir = path.join(sandbox, rel);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!LINK.has(e.name) && !SKIP.has(e.name)) walk(r); continue; }
      if (!e.isFile()) continue;
      const orig = path.join(repo, r);
      if (!fs.existsSync(orig) || !fs.readFileSync(orig).equals(fs.readFileSync(path.join(sandbox, r)))) out.push(r);
    }
  };
  walk('');
  // deleted files
  const gone = [];
  const walkOrig = (rel) => {
    const dir = path.join(repo, rel);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!LINK.has(e.name) && !SKIP.has(e.name)) walkOrig(r); continue; }
      if (e.isFile() && !fs.existsSync(path.join(sandbox, r))) gone.push(r);
    }
  };
  walkOrig('');
  return [...out, ...gone].sort();
}

/** A unified diff of the changed files, with a/ and b/ paths relative to the project root. */
export function makePatch(repo, sandbox, files) {
  const parts = [];
  for (const f of files) {
    const a = path.join(repo, f), b = path.join(sandbox, f);
    const r = sh('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', fs.existsSync(a) ? a : '/dev/null', fs.existsSync(b) ? b : '/dev/null']);
    // git prints absolute paths for --no-index; rewrite them to a/<file> and b/<file>
    parts.push(r.stdout
      .split(a).join(`/${f}`).split(b).join(`/${f}`)
      .replace(/^diff --git a\/+(.*?) b\/+(.*)$/m, `diff --git a/${f} b/${f}`)
      .replace(/^--- a\/+(.*)$/m, `--- a/${f}`).replace(/^\+\+\+ b\/+(.*)$/m, `+++ b/${f}`));
  }
  return parts.join('');
}

/** Rewrite a repro's relative imports (JS) so they point into the sandbox copy instead of the project. */
function retarget(source, fromDir, toDir, repo, sandbox) {
  return source.replace(/(from\s+|import\s*\(\s*|require\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (m, pre, q, spec) => {
    const abs = path.resolve(fromDir, spec);
    const inSandbox = abs.startsWith(repo + path.sep) ? path.join(sandbox, path.relative(repo, abs)) : abs;
    let rel = path.relative(toDir, inSandbox).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return `${pre}${q}${rel}${q}`;
  });
}

/** Run the project's own tests. Returns { ok, ran, output, ms } or { ran: false } when there is no suite. */
async function runSuite(lang, root, cfg) {
  const s = cfg.testCommand ? { cmd: 'sh', args: ['-c', cfg.testCommand] } : lang.suite?.(root, cfg);
  if (!s) return { ran: false };
  const r = await run(s.cmd, s.args, { cwd: s.cwd || root, env: { ...process.env, ...(cfg.env || {}), ...(s.env || {}) }, timeoutMs: (cfg.suiteTimeoutSec || 900) * 1000 });
  return { ran: true, ok: r.code === 0 && !r.timedOut, timedOut: r.timedOut, ms: r.ms, output: `${r.stdout}\n${r.stderr}`.trim().slice(-3000), command: [s.cmd, ...s.args].join(' ') };
}

/**
 * Try to fix each confirmed bug. Sets `bug.fix` = { status: 'verified' | 'rejected' | 'failed', reason,
 * patch, files, suite }. Each attempt runs in a copy of the project outside it (so build tools that
 * search parent directories never see the original), and the agent works inside that copy.
 */
export async function fixBugs({ repo, cfg, lang, agent, bugs, runRel, binPath, opts, account, overBudget }) {
  if (!bugs.length) return;
  log(c.dim(`\n  writing fixes for ${bugs.length} bug${bugs.length > 1 ? 's' : ''}…`));
  const shared = { ...cfg, cargoTargetDir: cfg.cargoTargetDir || path.join(repo, '.proofhound', 'rust', 'target'), suiteTargetDir: path.join(repo, '.proofhound', 'rust', 'suite-target') };
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofhound-fix-'));
  // The baseline suite also runs in a pristine copy, so the project's tree is never written to.
  let baseline = null;
  const getBaseline = () => (baseline ||= (async () => {
    const dir = path.join(tmpRoot, 'baseline');
    try { makeSandbox(repo, dir); } catch { return { ran: false }; }
    const res = await runSuite(lang, dir, shared);
    fs.rmSync(dir, { recursive: true, force: true });
    return res;
  })());

  await pool(bugs, opts.jobs || 2, async (bug) => {
    if (overBudget()) { bug.fix = { status: 'failed', reason: 'not attempted: budget reached' }; return; }
    const dir = path.join(repo, runRel, 'fix', bug.bugId);
    const sandbox = path.join(tmpRoot, bug.bugId);
    try { makeSandbox(repo, sandbox); } catch (e) { bug.fix = { status: 'failed', reason: e.message }; return; }
    try { await attempt(bug, dir, sandbox); } finally {
      if (opts.keepSandbox) log(c.dim(`    sandbox kept at ${sandbox}`));
      else fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });
  if (!opts.keepSandbox) fs.rmSync(tmpRoot, { recursive: true, force: true });

  async function attempt(bug, dir, sandbox) {
    const testCmd = writeTestWrapper(sandbox, binPath);
    // the agent's test runs reuse proofhound's Rust build cache instead of rebuilding in the sandbox
    const cfgFile = path.join(sandbox, '.proofhound', 'config.json');
    const fileCfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
    fs.writeFileSync(cfgFile, JSON.stringify({ ...fileCfg, cargoTargetDir: shared.cargoTargetDir }, null, 2));
    // the repro, placed inside the sandbox so it runs against the sandboxed code
    const workdir = path.join(repo, bug.workdir);
    const checkDir = path.join(sandbox, '.proofhound', 'check');
    const placeRepro = () => {
      fs.rmSync(checkDir, { recursive: true, force: true });
      fs.mkdirSync(checkDir, { recursive: true });
      const src = fs.readFileSync(path.join(workdir, bug.verification.reproFile), 'utf8');
      fs.writeFileSync(path.join(checkDir, bug.verification.reproFile), lang.id === 'javascript' ? retarget(src, workdir, checkDir, repo, sandbox) : src);
      const target = path.join(workdir, 'ph-target.json');
      if (fs.existsSync(target)) fs.copyFileSync(target, path.join(checkDir, 'ph-target.json'));
      return path.join(checkDir, bug.verification.reproFile);
    };
    const reproRel = path.relative(sandbox, placeRepro()).split(path.sep).join('/');

    const prompt = fixerPrompt({ bug, lang, reproRel, testCmd, notes: cfg.notes });
    writeFile(path.join(dir, 'prompt.md'), prompt);
    log(c.dim(`  ▸ fixing ${bug.bugId} ${bug.review?.title || bug.title}`));
    const r = await agent.call({ prompt, cwd: sandbox, writeDirs: ['.'], runCommands: [testCmd], model: opts.model, timeoutMs: (cfg.agentTimeoutSec || 1200) * 1000 });
    account(r);
    writeFile(path.join(dir, 'agent.txt'), `${r.text || ''}\n${r.error ? `ERROR: ${r.error}\n` : ''}${r.denials?.length ? `Permission denials:\n${r.denials.join('\n')}\n` : ''}`);

    const files = changedFiles(repo, sandbox);
    const reject = (reason, extra = {}) => { bug.fix = { status: 'rejected', reason, files, ...extra }; log(`  ${c.dim('·')} ${c.dim(bug.bugId)} ${c.yellow(`fix rejected: ${reason}`)}`); };
    if (!files.length) return reject(r.ok ? 'the agent did not change any file' : `agent failed: ${(r.error || '').split('\n')[0]}`);
    const patch = makePatch(repo, sandbox, files);
    writeFile(path.join(dir, 'fix.patch'), patch);

    // 1. a fresh copy of the repro (in case the agent edited it) must pass on the patched code
    const fresh = placeRepro();
    const rr = await lang.runTests(sandbox, shared, [fresh], { cwd: sandbox, timeoutMs: (cfg.testTimeoutSec || lang.testTimeoutSec || 120) * 1000, ts: lang.id === 'javascript' });
    const failed = rr.tests.filter((t) => t.outcome !== 'passed' && t.outcome !== 'skipped');
    if (!rr.tests.length || failed.length) {
      const why = !rr.tests.length ? 'the repro did not run on the patched code' : `the repro still fails: ${failed[0].error ? `${failed[0].error.type}: ${String(failed[0].error.message).split('\n')[0].slice(0, 160)}` : 'it could not be loaded'}`;
      return reject(why, { patch });
    }
    // 2. the project's own suite must not go from green to red
    const base = await getBaseline();
    let suite = 'not run (no test command found; set "testCommand" in .proofhound/config.json)';
    if (base.ran) {
      if (!base.ok) suite = `not compared (the suite already fails without the fix: ${base.command})`;
      else {
        const after = await runSuite(lang, sandbox, shared);
        if (!after.ok) return reject(`the project's tests fail with the fix (${after.command})`, { patch, suiteOutput: after.output });
        suite = `passed (${after.command})`;
      }
    }
    bug.fix = { status: 'verified', reason: 'the repro passes on the patched code', patch, files, suite };
    log(`  ${c.green('✓')} ${c.bold(bug.bugId)} fixed ${c.dim(`(${files.join(', ')}; suite ${suite.split(' (')[0]})`)}`);
  }
}
