import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, sh, readJSON, hash } from '../util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.join(HERE, 'python');

function interpreter(repo, cfg = {}) {
  if (cfg.python) return cfg.python;
  if (process.env.VIRTUAL_ENV) return path.join(process.env.VIRTUAL_ENV, 'bin', 'python');
  for (const d of ['.venv', 'venv', 'env']) {
    const p = path.join(repo, d, 'bin', 'python');
    if (fs.existsSync(p)) return p;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function pythonPath(repo) {
  const parts = [PLUGIN_DIR, repo];
  for (const d of ['src', 'lib']) {
    const p = path.join(repo, d);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) parts.push(p);
  }
  if (process.env.PYTHONPATH) parts.push(process.env.PYTHONPATH);
  return parts.join(path.delimiter);
}

export const python = {
  id: 'python',
  name: 'Python',
  framework: 'Hypothesis',
  ext: '.py',

  detect(repo) {
    if (['pyproject.toml', 'setup.py', 'setup.cfg'].some((f) => fs.existsSync(path.join(repo, f)))) return true;
    const hasPy = (dir, depth) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
      return entries.some((e) => (e.isFile() && e.name.endsWith('.py'))
        || (depth > 0 && e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && hasPy(path.join(dir, e.name), depth - 1)));
    };
    return hasPy(repo, 2);
  },

  interpreter,

  check(repo, cfg) {
    const py = interpreter(repo, cfg);
    const r = sh(py, ['-c', 'import sys, pytest, hypothesis; print(sys.version.split()[0], pytest.__version__, hypothesis.__version__)'],
      { cwd: repo, env: { ...process.env, PYTHONPATH: pythonPath(repo) } });
    if (r.code !== 0) {
      const missing = /No module named '?(\w+)/.exec(r.stderr);
      return {
        ok: false,
        problem: missing
          ? `${py} cannot import ${missing[1]}. Install it with: ${py} -m pip install pytest hypothesis`
          : `could not run ${py}: ${r.stderr.trim().split('\n').pop()}`,
      };
    }
    const [version, pytestV, hypoV] = r.stdout.trim().split(' ');
    return { ok: true, info: `Python ${version}, pytest ${pytestV}, Hypothesis ${hypoV} (${py})` };
  },

  listTargets(repo, cfg, only = []) {
    const py = interpreter(repo, cfg);
    const r = sh(py, [path.join(PLUGIN_DIR, 'ph_targets.py'), repo, ...only], { cwd: repo });
    if (r.code !== 0) throw new Error(`target scan failed: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
    return JSON.parse(r.stdout).map((t) => ({ ...t, lang: 'python', id: `${t.module}.${t.qualname}` }));
  },

  importHint(target) {
    return target.owner
      ? `from ${target.module} import ${target.owner}`
      : `from ${target.module} import ${target.name}`;
  },

  needsTs() { return false; },

  files() {
    return { props: 'test_ph_props.py', repro: 'test_repro_<name>.py' };
  },

  /**
   * Run tests and return normalized results.
   * `selectors` are pytest node ids or file paths. Each result: { id, outcome, error }.
   */
  async runTests(repo, cfg, selectors, { cwd = repo, timeoutMs = 300000, seed, maxExamples } = {}) {
    const py = interpreter(repo, cfg);
    const reportFile = path.join(os.tmpdir(), `ph-report-${process.pid}-${hash(selectors.join(' ') + Math.random(), 6)}.json`);
    const args = ['-m', 'pytest', '-p', 'ph_pytest_plugin', '-p', 'no:cacheprovider', '-q', '--no-header', '-rN',
      '--tb=short', '-o', 'addopts=', '--rootdir', cwd, ...selectors];
    if (seed != null) args.push(`--hypothesis-seed=${seed}`);
    const env = {
      ...process.env, ...(cfg.env || {}),
      PYTHONPATH: pythonPath(repo), PROOFHOUND_REPORT: reportFile, PYTHONDONTWRITEBYTECODE: '1',
      PYTHONHASHSEED: '0', PROOFHOUND_MAX_EXAMPLES: String(maxExamples || cfg.maxExamples || 300),
    };
    const r = await run(py, args, { cwd, env, timeoutMs });
    const data = readJSON(reportFile, null);
    fs.rmSync(reportFile, { force: true });
    const tests = (data?.tests || []).map((t) => ({
      id: t.nodeid,
      name: t.nodeid.split('::').pop(),
      outcome: t.when === 'collect' ? 'error' : t.when === 'setup' && t.outcome === 'failed' ? 'error' : t.outcome,
      error: t.error ? normalizeError(t.error) : null,
      longrepr: t.longrepr || null,
    }));
    return { code: r.code, timedOut: r.timedOut, ms: r.ms, tests, output: `${r.stdout}\n${r.stderr}` };
  },

  suite(repo, cfg = {}) {
    const hasTests = ['tests', 'test', 'testing'].some((d) => fs.existsSync(path.join(repo, d)))
      || ['pytest.ini', 'tox.ini', 'setup.cfg', 'pyproject.toml'].some((f) => fs.existsSync(path.join(repo, f)) && /pytest/.test(fs.readFileSync(path.join(repo, f), 'utf8')));
    if (!hasTests) return null;
    const parts = [repo, ...['src', 'lib'].map((d) => path.join(repo, d)).filter((p) => fs.existsSync(p))];
    return { cmd: interpreter(repo, cfg), args: ['-m', 'pytest', '-q', '-x', '-p', 'no:cacheprovider', '--no-header'], env: { PYTHONPATH: parts.join(path.delimiter), PYTHONDONTWRITEBYTECODE: '1' } };
  },

  /** Exception types that mean the test itself is broken, not the code under test. */
  testErrorTypes: [
    'NameError', 'ImportError', 'ModuleNotFoundError', 'SyntaxError', 'IndentationError', 'UnboundLocalError',
    /^hypothesis\.errors\./, 'pytest.fixtures.FixtureLookupError',
  ],

  isExplicitRaise(frame) {
    return /^\s*raise\b/.test(frame?.code || '');
  },
};

function normalizeError(e) {
  const out = {
    type: e.type, message: e.message, notes: e.notes || [],
    frames: (e.frames || []).map((f) => ({ file: f.file, line: f.line, func: f.func, code: f.code })),
  };
  if (e.group) out.group = e.group.map(normalizeError);
  if (e.cause) out.cause = e.cause;
  // Hypothesis attaches "Falsifying example: ..." as a note.
  const fx = out.notes.find((n) => /^(Falsifying|Failing) (explicit )?(example|test case)/.test(n));
  if (fx) out.example = fx;
  return out;
}
