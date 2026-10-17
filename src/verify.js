import fs from 'node:fs';
import path from 'node:path';

const VENDOR = /[/\\](site-packages|dist-packages|node_modules|\.venv|venv|lib[/\\]python\d|\.cache[/\\]proofhound|vendor|\.cargo|pkg[/\\]mod|\.proofhound)[/\\]/;

// A repro must be a fixed input. Randomness, clocks or property-test machinery disqualify it.
const NONDETERMINISM = [
  /^\s*(import random|from random import)/m, /\bsecrets\./, /\buuid\.uuid[14]\(/, /\btime\.time\(/, /datetime\.(now|utcnow|today)\(/,
  /^\s*from hypothesis import|^\s*import hypothesis/m, /\bMath\.random\(/, /\bDate\.now\(/, /\bnew Date\(\s*\)/,
  /crypto\.(randomUUID|getRandomValues|randomBytes)/, /from ['"]fast-check['"]/,
  /"math\/rand(\/v2)?"/, /"pgregory\.net\/rapid"/, /\btime\.Now\(/, /"crypto\/rand"/,
  /\buse proptest\b|\bproptest!/, /\brand::/, /\b(SystemTime|Instant)::now\(/,
];

function matchesAny(value, list) {
  return list.some((p) => (p instanceof RegExp ? p.test(value) : value === p || value.endsWith('.' + p)));
}

/**
 * Decide what a failure means.
 *   kind: 'assertion' (wrong result), 'crash' (exception from project code),
 *         'internal-assert' (assert inside project code), or 'test-error' (the test is broken).
 */
export function classify(error, { repo, workdir, lang }) {
  if (!error) return { kind: 'test-error', reason: 'no error information' };
  const e = error.group && error.group.length ? error.group[0] : error;
  const type = String(e.type || '');
  const code = e.code || '';
  if (matchesAny(type, lang.testErrorTypes) || (code && matchesAny(code, lang.testErrorTypes))) {
    return { kind: 'test-error', reason: `${type} means the test itself is broken`, type };
  }
  const frames = (e.frames || []).filter((f) => f.file && !f.file.startsWith('node:'));
  const workAbs = path.resolve(workdir);
  const inWork = (f) => path.resolve(f.file).startsWith(workAbs + path.sep);
  const inProject = (f) => path.resolve(f.file).startsWith(path.resolve(repo) + path.sep) && !inWork(f) && !VENDOR.test(f.file);
  const projectFrames = frames.filter(inProject);
  const deepest = frames[frames.length - 1];
  const site = projectFrames[projectFrames.length - 1] || null;
  const rel = (f) => f && { ...f, file: path.relative(repo, f.file).split(path.sep).join('/') };

  // pytest.raises(...) that did not raise, or pytest.fail(), is the test's assertion failing.
  if (/AssertionError$|(^|\.)Failed$/.test(type)) {
    if (deepest && inProject(deepest)) return { kind: 'internal-assert', type, site: rel(deepest) };
    return { kind: 'assertion', type, site: null };
  }
  if (!site) return { kind: 'test-error', reason: `${type} was raised outside the project's code`, type };
  if (deepest && inWork(deepest)) return { kind: 'test-error', reason: `${type} was raised inside the test, not the project`, type };
  return { kind: 'crash', type, site: rel(site), explicitRaise: lang.isExplicitRaise(site) };
}

export function signature(cls, testName) {
  if (cls.kind === 'assertion') return `assertion:${testName}`;
  return `${cls.kind}:${cls.type}:${cls.site ? `${cls.site.file}:${cls.site.line}` : ''}`;
}

/**
 * Re-run a finding's repro `runs` times in fresh processes; it is verified only if it fails
 * every time, for the same reason, from the project's code (or a wrong result).
 */
export async function verifyFinding(finding, { repo, cfg, lang, workdir, runs = 3, ts }) {
  const reproFile = finding.repro_file && path.basename(String(finding.repro_file));
  const reject = (reason, extra = {}) => ({ verified: false, reason, reproFile, ...extra });
  if (!reproFile) return reject('no repro file given');
  const abs = path.join(workdir, reproFile);
  if (!fs.existsSync(abs)) return reject(`repro file ${reproFile} does not exist`);
  const nondet = NONDETERMINISM.find((re) => re.test(fs.readFileSync(abs, 'utf8')));
  if (nondet) return reject(`repro is not deterministic (uses ${nondet.source.replace(/\\[bs]|[\\()|?:]/g, ' ').trim().split(/\s+/)[0]})`);

  const results = [];
  for (let i = 0; i < runs; i++) {
    const r = await lang.runTests(repo, cfg, [abs], { cwd: repo, timeoutMs: (cfg.testTimeoutSec || lang.testTimeoutSec || 120) * 1000, ts });
    if (r.timedOut) return reject('repro timed out');
    const failed = r.tests.filter((t) => t.outcome === 'failed' || t.outcome === 'error');
    if (!r.tests.length) return reject('repro file has no runnable tests', { output: r.output.slice(-1500) });
    if (!failed.length) return reject(i === 0 ? 'repro passes: the bug did not reproduce' : `flaky: passed on run ${i + 1} of ${runs}`);
    const t = failed[0];
    if (t.outcome === 'error' && !t.error) return reject('repro could not be collected or loaded', { output: (t.longrepr || r.output).slice(-1500) });
    const cls = classify(t.error, { repo, workdir, lang });
    results.push({ test: t, cls, sig: signature(cls, t.name) });
  }
  const first = results[0];
  if (first.cls.kind === 'test-error') return reject(`test error: ${first.cls.reason}`, { error: first.test.error });
  if (results.some((x) => x.sig !== first.sig)) return reject('flaky: the failure changed between runs');
  return {
    verified: true,
    reproFile,
    runs,
    kind: first.cls.kind,
    signature: first.sig,
    site: first.cls.site,
    explicitRaise: Boolean(first.cls.explicitRaise),
    error: { type: first.test.error.type, message: first.test.error.message, example: first.test.error.example },
    testName: first.test.name,
  };
}

/** Confirm the property test itself fails (supporting evidence; the repro is the proof). */
export async function confirmProperty(finding, { repo, cfg, lang, workdir, propsFile, ts }) {
  if (!finding.property_test || !fs.existsSync(path.join(workdir, propsFile))) return null;
  const abs = path.join(workdir, propsFile);
  const selector = lang.id === 'python' ? `${abs}::${finding.property_test}` : abs;
  const r = await lang.runTests(repo, cfg, [selector], { cwd: repo, timeoutMs: (cfg.testTimeoutSec || lang.testTimeoutSec || 120) * 1000, name: lang.id === 'python' ? undefined : finding.property_test, ts });
  const t = r.tests.find((x) => x.name === finding.property_test || x.id.endsWith(finding.property_test));
  if (!t) return null;
  return { failed: t.outcome === 'failed', example: t.error?.example || null };
}
