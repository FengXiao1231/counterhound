import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run, sh, readJSON, hash } from '../util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTER = path.join(HERE, 'js', 'reporter.mjs');
const CACHE = process.env.PROOFHOUND_CACHE || path.join(os.homedir(), '.cache', 'proofhound', 'js');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'test', 'tests', '__tests__',
  'spec', 'docs', 'examples', 'example', 'bench', 'benchmarks', 'fixtures', 'scripts', '.proofhound', 'vendor', 'types']);
const SRC_EXT = /\.(m?[jt]s|cjs|cts|mts|jsx|tsx)$/;
const SKIP_FILE = /(\.d\.ts|\.(test|spec|bench)\.[cm]?[jt]sx?|\.min\.js|\.config\.[cm]?[jt]s|rollup|webpack|vite|eslint|prettier|jest\.|babel)/;

function walk(root, start, out) {
  let entries;
  try { entries = fs.readdirSync(start, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(start, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(root, p, out); }
    else if (SRC_EXT.test(e.name) && !SKIP_FILE.test(e.name)) out.push(p);
  }
}

const IMPURE = /\b(fetch|require\(['"](fs|http|https|net|child_process)['"]\)|fs\.|process\.env|Date\.now|new Date\(\)|Math\.random|setTimeout|setInterval|localStorage|document\.|window\.|XMLHttpRequest|console\.)/g;

/** Find the end of a function body by brace matching (good enough for ranking, not parsing). */
function bodyExtent(lines, startLine) {
  let depth = 0, seen = false, parens = 0;
  for (let i = startLine; i < Math.min(lines.length, startLine + 600); i++) {
    const l = lines[i].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, '');
    for (const ch of l) {
      if (!seen && (ch === '(' || ch === ')')) parens += ch === '(' ? 1 : -1;
      else if (!seen && parens > 0) continue; // braces of a destructured parameter, not the body
      else if (ch === '{') { depth++; seen = true; }
      else if (ch === '}') depth--;
    }
    if (seen && depth <= 0) return i;
    if (!seen && /=>\s*[^{\s]/.test(l) && i === startLine) return i; // expression-bodied arrow
  }
  return startLine;
}

function jsdocBefore(lines, i) {
  let j = i - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  if (j < 0 || !lines[j].trim().endsWith('*/')) return '';
  const end = j;
  while (j >= 0 && !lines[j].includes('/**')) j--;
  if (j < 0) return '';
  return lines.slice(j, end + 1).map((l) => l.replace(/^\s*\/?\*+\/?\s?/, '').replace(/\*\/\s*$/, '')).join('\n').trim();
}

function countArgs(params) {
  const p = params.replace(/\{[^}]*\}|\[[^\]]*\]|<[^>]*>|\([^)]*\)/g, 'x').trim();
  return p ? p.split(',').filter((s) => s.trim()).length : 0;
}

const ID = '[A-Za-z_$][\\w$]*';

/** Keys of an object literal starting at `open` (the index of "{"): key -> local name. */
function objectKeys(src, open) {
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  const body = src.slice(open + 1, i).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const keys = new Map();
  // only look at the top level of the literal
  let level = 0, cur = '';
  const parts = [];
  for (const ch of body) {
    if ('{[('.includes(ch)) level++;
    if ('}])'.includes(ch)) level--;
    if (ch === ',' && level === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  for (const part of parts) {
    const p = part.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let m;
    if ((m = p.match(new RegExp(`^['"]?(${ID})['"]?\\s*:\\s*(${ID})$`)))) keys.set(m[1], m[2]);
    else if ((m = p.match(new RegExp(`^(${ID})$`)))) keys.set(m[1], m[1]);
  }
  return keys;
}

/**
 * Work out what a file exports, as a map local name -> { name, access }.
 * access: 'named' (ESM named), 'default' (ESM default or module.exports = fn), 'prop' (module.exports.x / exported object key).
 */
function exportsOf(src, file) {
  const ex = new Map();
  const add = (local, name, access) => { if (!ex.has(local)) ex.set(local, { name, access }); };
  const esm = /^\s*export\s/m.test(src) || /\.(mjs|mts|ts|tsx)$/.test(file);
  for (const m of src.matchAll(new RegExp(`^\\s*export\\s+(?:async\\s+)?function\\*?\\s+(${ID})`, 'gm'))) add(m[1], m[1], 'named');
  for (const m of src.matchAll(new RegExp(`^\\s*export\\s+(?:const|let|var)\\s+(${ID})`, 'gm'))) add(m[1], m[1], 'named');
  for (const m of src.matchAll(new RegExp(`^\\s*export\\s+default\\s+(?:async\\s+)?function\\*?\\s+(${ID})`, 'gm'))) ex.set(m[1], { name: m[1], access: 'default' });
  for (const m of src.matchAll(new RegExp(`^\\s*export\\s+default\\s+(${ID})\\s*;?\\s*$`, 'gm'))) add(m[1], m[1], 'default');
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const n of m[1].split(',')) {
      const [local, alias] = n.trim().split(/\s+as\s+/);
      if (local) add(local.trim(), (alias || local).trim(), (alias || '').trim() === 'default' ? 'default' : 'named');
    }
  }
  if (!esm) {
    for (const m of src.matchAll(new RegExp(`(?:module\\.)?exports\\.(${ID})\\s*=\\s*(${ID})\\s*;?\\s*$`, 'gm'))) add(m[2], m[1], 'prop');
    const target = src.match(new RegExp(`module\\.exports\\s*=\\s*(${ID})\\s*;?\\s*$`, 'm'));
    const literal = src.match(/module\.exports\s*=\s*\{/);
    if (literal) for (const [k, local] of objectKeys(src, literal.index + literal[0].length - 1)) add(local, k, 'prop');
    if (target) {
      // module.exports = he, where `var he = { encode: encode, ... }` -> exported properties
      const obj = src.match(new RegExp(`(?:var|let|const)\\s+${target[1].replace('$', '\\$')}\\s*=\\s*\\{`));
      if (obj) for (const [k, local] of objectKeys(src, obj.index + obj[0].length - 1)) add(local, k, 'prop');
      else add(target[1], target[1], 'default');
    }
    // UMD: root.he = he / define(function() { return he; }) with the same object literal
    for (const m of src.matchAll(new RegExp(`(?:var|let|const)\\s+(${ID})\\s*=\\s*\\{\\s*\\n?\\s*['"]?version['"]?\\s*:`, 'g'))) {
      for (const [k, local] of objectKeys(src, m.index + m[0].length - m[0].slice(m[0].indexOf('{')).length)) add(local, k, 'prop');
    }
  }
  return { ex, esm };
}

export function scanFile(root, file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.length > 400000) return [];
  const lines = src.split('\n');
  const rel = path.relative(root, file).split(path.sep).join('/');
  const { ex, esm } = exportsOf(src, file);
  const baseName = path.basename(file).replace(/\.[^.]+$/, '').replace(/[-_.](\w)/g, (_, ch) => ch.toUpperCase());
  const out = [];
  const defs = [
    // function name(params)
    new RegExp(`^\\s*(?:export\\s+(?:default\\s+)?)?(async\\s+)?function\\*?\\s+(${ID})\\s*(<[^>]*>)?\\s*\\(([^)]*)\\)\\s*(:\\s*[^{]+)?`),
    // const name = (params) => / function (params)
    new RegExp(`^\\s*(?:export\\s+)?(?:const|let|var)\\s+(${ID})\\s*(?::\\s*[^=]+)?=\\s*(async\\s+)?(?:function\\s*\\*?\\s*(?:${ID})?\\s*)?\\(([^)]*)\\)\\s*(:\\s*[^=]+)?(=>)?`),
    // exports.name = function (params)
    new RegExp(`^\\s*(?:module\\.)?exports\\.(${ID})\\s*=\\s*(async\\s+)?(?:function\\s*\\*?\\s*(?:${ID})?\\s*)?\\(([^)]*)\\)`),
    // module.exports = function (params) / (params) =>
    new RegExp(`^\\s*module\\.exports\\s*=\\s*(async\\s+)?(?:function\\s*\\*?\\s*(${ID})?\\s*)?\\(([^)]*)\\)`),
  ];
  lines.forEach((raw, i) => {
    let local, params, isAsync, ret, info, m;
    // a parameter list that spans lines: join until the parentheses balance
    let line = raw;
    const open = (x) => (x.match(/\(/g) || []).length - (x.match(/\)/g) || []).length;
    if (/\bfunction\b|=\s*(async\s*)?\(\s*$|=\s*(async\s*)?\([^)]*$/.test(raw) && open(raw) > 0) {
      for (let k = i + 1; k < Math.min(lines.length, i + 30) && open(line) > 0; k++) line += ' ' + lines[k].replace(/\/\/.*$/, '').trim();
    }
    if ((m = line.match(defs[0]))) { [, isAsync, local, , params, ret] = m; info = ex.get(local); }
    else if ((m = line.match(defs[1]))) {
      [, local, isAsync, params, ret] = m;
      if (!m[5] && !/function/.test(line)) return; // `const x = (a)` without => is not a function
      info = ex.get(local);
    } else if ((m = line.match(defs[2]))) { [, local, isAsync, params] = m; info = { name: local, access: 'prop' }; }
    else if ((m = line.match(defs[3]))) { [, isAsync, local, params] = m; local = local || baseName; info = { name: local, access: 'default' }; }
    if (!local || !info || info.name.startsWith('_')) return;
    if (/\)\s*(:[^{]*)?;\s*$/.test(line)) return; // TypeScript overload signature, no body
    if (out.some((f) => f.name === info.name)) return;
    const end = bodyExtent(lines, i);
    const body = lines.slice(i, end + 1).join('\n');
    const impure = [...new Set([...body.matchAll(IMPURE)].map((x) => x[1].replace(/[.(].*$/, '')))];
    out.push({
      file: rel, module: rel, name: info.name, local, access: info.access, esm, qualname: info.name, owner: null, line: i + 1, loc: end - i + 1,
      signature: `(${(params || '').trim()})${ret ? ret.replace(/^:\s*/, ': ').trim() : ''}`,
      nArgs: countArgs(params || ''), doc: jsdocBefore(lines, i).slice(0, 600), async: Boolean(isAsync),
      impure, annotated: /:/.test(params || '') || Boolean(ret), decorators: [],
    });
  });
  return out;
}

/** Files named as the package's public entry points (main/module/exports/source). */
function entryFiles(repo) {
  const pkg = readJSON(path.join(repo, 'package.json'), {}) || {};
  const out = new Set();
  const addPath = (p) => {
    if (typeof p !== 'string') return;
    const rel = p.replace(/^\.\//, '');
    for (const cand of [rel, `${rel}.js`, `${rel}/index.js`, rel.replace(/^(dist|lib|build)\//, 'src/').replace(/\.(c|m)?js$/, '.ts'), rel.replace(/^(dist|build)\//, 'src/')]) {
      if (fs.existsSync(path.join(repo, cand)) && fs.statSync(path.join(repo, cand)).isFile()) out.add(cand);
    }
  };
  const walkExports = (e) => { if (typeof e === 'string') addPath(e); else if (e && typeof e === 'object') Object.values(e).forEach(walkExports); };
  [pkg.main, pkg.module, pkg.source, pkg.types && null].forEach(addPath);
  walkExports(pkg.exports);
  if (!out.size) ['index.js', 'src/index.ts', 'src/index.js'].forEach(addPath);
  return out;
}

function hasFastCheck(repo) { return fs.existsSync(path.join(repo, 'node_modules', 'fast-check', 'package.json')); }
function cacheReady() { return fs.existsSync(path.join(CACHE, 'node_modules', 'fast-check', 'package.json')) && fs.existsSync(path.join(CACHE, 'node_modules', 'tsx', 'package.json')); }

function tsxLoader(repo) {
  const local = path.join(repo, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs');
  if (fs.existsSync(local)) return pathToFileURL(local).href;
  return pathToFileURL(path.join(CACHE, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs')).href;
}

function parseStack(stack) {
  const frames = [];
  for (const line of String(stack || '').split('\n')) {
    const m = line.match(/^\s*at (?:(.*?) \()?((?:file:\/\/)?\/[^():]+|node:[^():]+|[A-Za-z]:\\[^():]+):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    let file = m[2];
    if (file.startsWith('file://')) { try { file = fileURLToPath(file); } catch { /* keep */ } }
    frames.push({ file, line: +m[3], func: m[1] || '<anonymous>', code: '' });
  }
  return frames.reverse(); // outermost first, deepest last (same order as Python)
}

function sourceLine(file, line) {
  try { return fs.readFileSync(file, 'utf8').split('\n')[line - 1] || ''; } catch { return ''; }
}

function normalizeError(e) {
  if (!e) return null;
  let primary = e;
  let example = null;
  const pm = /^Property failed after/.test(e.message || '');
  if (pm) {
    const cx = (e.message.match(/Counterexample: (.*)/) || [])[1];
    example = cx ? `Counterexample: ${cx}` : null;
    if (e.cause) primary = e.cause;
  }
  const frames = parseStack(primary.stack);
  for (const f of frames) if (!f.file.startsWith('node:')) f.code = sourceLine(f.file, f.line).trim().slice(0, 300);
  return {
    type: primary.code === 'ERR_ASSERTION' ? 'AssertionError' : primary.type,
    message: String(primary.message || '').slice(0, 2000),
    notes: [], frames, example,
    actual: primary.actual, expected: primary.expected,
  };
}

export const javascript = {
  id: 'javascript',
  name: 'JavaScript/TypeScript',
  framework: 'fast-check',
  ext: '.test.mjs',

  detect(repo) { return fs.existsSync(path.join(repo, 'package.json')); },

  /** Make fast-check importable from proofhound's work directory. */
  prepare(repo, workRoot) {
    const localTsx = fs.existsSync(path.join(repo, 'node_modules', 'tsx', 'package.json'));
    if (hasFastCheck(repo) && localTsx) return;
    if (!cacheReady()) {
      fs.mkdirSync(CACHE, { recursive: true });
      if (!fs.existsSync(path.join(CACHE, 'package.json'))) fs.writeFileSync(path.join(CACHE, 'package.json'), '{"name":"proofhound-cache","private":true}\n');
      const r = sh('npm', ['install', '--no-audit', '--no-fund', '--silent', 'fast-check@4', 'tsx@4'], { cwd: CACHE });
      if (r.code !== 0) throw new Error(`could not install fast-check into ${CACHE}: ${r.stderr.trim().slice(-300)}`);
    }
    const link = path.join(workRoot, 'node_modules');
    if (!hasFastCheck(repo) && !fs.existsSync(link)) {
      fs.mkdirSync(workRoot, { recursive: true });
      fs.symlinkSync(path.join(CACHE, 'node_modules'), link, 'dir');
    }
  },

  check(repo) {
    const v = process.versions.node.split('.').map(Number);
    if (v[0] < 20) return { ok: false, problem: `Node ${process.versions.node} is too old; proofhound needs Node 20+` };
    return { ok: true, info: `Node ${process.versions.node}, fast-check ${hasFastCheck(repo) ? '(project)' : '(proofhound cache)'}` };
  },

  listTargets(repo, cfg, only = []) {
    const files = [];
    const starts = only.length ? only.map((o) => path.join(repo, o)) : [repo];
    for (const s of starts) {
      if (fs.existsSync(s) && fs.statSync(s).isFile()) files.push(s);
      else walk(repo, s, files);
    }
    const entries = entryFiles(repo);
    return files.flatMap((f) => scanFile(repo, f)).map((t) => ({ ...t, entry: entries.has(t.file), lang: 'javascript', id: `${t.file}#${t.qualname}` }));
  },

  importHint(target, fromDir, repo) {
    let rel = path.relative(fromDir, path.join(repo, target.file)).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    if (target.access === 'default') return `import ${target.name} from '${rel}'`;
    if (target.access === 'prop' || !target.esm) return `import mod from '${rel}'; const ${target.name} = mod.${target.name}`;
    return `import { ${target.name} } from '${rel}'`;
  },

  files() { return { props: 'ph_props.test.mjs', repro: 'repro_<name>.test.mjs' }; },

  // tsx also resolves extensionless and directory imports in plain JS sources, so use it whenever available.
  needsTs() { return true; },

  async runTests(repo, cfg, selectors, { cwd = repo, timeoutMs = 300000, seed, name, ts } = {}) {
    const reportFile = path.join(os.tmpdir(), `ph-report-${process.pid}-${hash(selectors.join(' ') + Math.random(), 8)}.json`);
    const args = [];
    if (ts) args.push('--import', tsxLoader(repo));
    args.push('--test', `--test-reporter=${pathToFileURL(REPORTER).href}`, '--test-reporter-destination=stdout');
    if (name) args.push(`--test-name-pattern=^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    args.push(...selectors);
    const env = { ...process.env, ...(cfg.env || {}), PROOFHOUND_REPORT: reportFile, FORCE_COLOR: '0', NO_COLOR: '1' };
    delete env.NODE_TEST_CONTEXT; // otherwise a parent node:test run swallows the results
    if (seed != null) env.PROOFHOUND_SEED = String(seed);
    const r = await run(process.execPath, args, { cwd, env, timeoutMs });
    const data = readJSON(reportFile, null);
    fs.rmSync(reportFile, { force: true });
    const tests = (data?.tests || []).map((t) => ({
      id: `${t.file}::${t.name}`, name: t.name, outcome: t.outcome, error: normalizeError(t.error), longrepr: t.error ? `${t.error.message}\n${t.error.stack}` : null,
    }));
    // A file that fails to load produces a synthetic failing "test" named after the file.
    for (const t of tests) {
      if (t.error && /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find module|does not provide an export/.test(`${t.error.type} ${t.error.message}`)) t.outcome = 'error';
    }
    return { code: r.code, timedOut: r.timedOut, ms: r.ms, tests, output: `${r.stdout}\n${r.stderr}` };
  },

  suite(repo) {
    const pkg = readJSON(path.join(repo, 'package.json'), {}) || {};
    const t = pkg.scripts?.test;
    if (!t || /no test specified/.test(t)) return null;
    return { cmd: 'npm', args: ['test', '--silent'], env: { CI: '1' } };
  },

  testErrorTypes: ['SyntaxError', 'ReferenceError', 'ERR_MODULE_NOT_FOUND', /^ERR_TEST/],

  isExplicitRaise(frame) { return /(^|[;{)]\s*)throw\s+(new\s+)?[\w$]/.test(frame?.code || ''); },
};
