import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractJSON, slug } from '../src/util.js';
import { classify, signature } from '../src/verify.js';
import { python } from '../src/lang/python.js';
import { javascript, scanFile } from '../src/lang/javascript.js';
import { planGroups, scoreTarget } from '../src/targets.js';
import { relocateImports } from '../src/report/bugs.js';
import { parseArgs } from '../src/cli.js';

test('extractJSON finds JSON inside prose and fences', () => {
  assert.deepEqual(extractJSON('Sure!\n```json\n[{"a":1}]\n```\nDone'), [{ a: 1 }]);
  assert.deepEqual(extractJSON('verdict follows {"verdict":"bug","confidence":0.9} thanks'), { verdict: 'bug', confidence: 0.9 });
  assert.equal(extractJSON('no json here'), null);
});

test('slug never ends with a dash', () => {
  assert.equal(slug('chunk() silently drops the trailing partial chunk', 18), 'chunk-silently-dro');
  assert.ok(!slug('a b c d e f g h', 6).endsWith('-'));
});

const repo = '/repo';
const workdir = '/repo/.proofhound/runs/1/g01';
const frame = (file, line = 1, code = '') => ({ file, line, func: 'f', code });

test('classify: assertion in the test is a wrong result', () => {
  const c = classify({ type: 'AssertionError', frames: [frame(`${workdir}/test_x.py`)] }, { repo, workdir, lang: python });
  assert.equal(c.kind, 'assertion');
  assert.equal(signature(c, 'test_x'), 'assertion:test_x');
});

test('classify: exception from project code is a crash, explicit raise is flagged', () => {
  const frames = [frame(`${workdir}/test_x.py`), frame('/repo/pkg/mod.py', 10, 'raise ValueError("bad")')];
  const c = classify({ type: 'ValueError', frames }, { repo, workdir, lang: python });
  assert.equal(c.kind, 'crash');
  assert.equal(c.site.file, 'pkg/mod.py');
  assert.equal(c.explicitRaise, true);
});

test('classify: crash inside stdlib called by project code is attributed to the project', () => {
  const frames = [frame(`${workdir}/test_x.py`), frame('/repo/pkg/mod.py', 5, 'return int(s)'), frame('/usr/lib/python3.13/foo.py', 3)];
  const c = classify({ type: 'ValueError', frames }, { repo, workdir, lang: python });
  assert.equal(c.kind, 'crash');
  assert.equal(c.site.line, 5);
  assert.equal(c.explicitRaise, false);
});

test('classify: broken tests are rejected', () => {
  assert.equal(classify({ type: 'NameError', frames: [frame(`${workdir}/t.py`)] }, { repo, workdir, lang: python }).kind, 'test-error');
  assert.equal(classify({ type: 'hypothesis.errors.Unsatisfiable', frames: [] }, { repo, workdir, lang: python }).kind, 'test-error');
  // TypeError raised at the call site in the test (wrong arguments), no project frame
  assert.equal(classify({ type: 'TypeError', frames: [frame(`${workdir}/t.py`)] }, { repo, workdir, lang: python }).kind, 'test-error');
  // raised in the test after the project returned
  const frames = [frame('/repo/pkg/mod.py'), frame(`${workdir}/t.py`)];
  assert.equal(classify({ type: 'KeyError', frames }, { repo, workdir, lang: python }).kind, 'test-error');
  // vendored code is not "the project"
  assert.equal(classify({ type: 'KeyError', frames: [frame(`${workdir}/t.py`), frame('/repo/.venv/lib/x.py')] }, { repo, workdir, lang: python }).kind, 'test-error');
});

test('classify: pytest.raises that did not raise counts as the test assertion failing', () => {
  assert.equal(classify({ type: '_pytest.outcomes.Failed', frames: [frame(`${workdir}/t.py`)] }, { repo, workdir, lang: python }).kind, 'assertion');
});

test('classify: an assert inside project code is an internal assertion', () => {
  const c = classify({ type: 'AssertionError', frames: [frame(`${workdir}/t.py`), frame('/repo/pkg/m.py', 7)] }, { repo, workdir, lang: python });
  assert.equal(c.kind, 'internal-assert');
});

test('javascript scanner finds exported functions with JSDoc', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-js-'));
  fs.writeFileSync(path.join(dir, 'a.js'), `/** Adds. */\nexport function add(a, b) {\n  return a + b;\n}\nexport const twice = (x) => x * 2;\nfunction hidden(x) { return x; }\nexport async function load(url) { return fetch(url); }\n`);
  fs.writeFileSync(path.join(dir, 'b.js'), `function hidden(x) { return x; }\nconst shown = function (s) {\n  return s;\n};\nconst api = {\n  /** it's, a comment (with commas) */\n  'version': '1.0',\n  'nested': { 'x': hidden },\n  'shown': shown\n};\nmodule.exports = api;\n`);
  fs.writeFileSync(path.join(dir, 'c.js'), `module.exports = function (str, opts) {\n  return str;\n};\n`);
  const fns = scanFile(dir, path.join(dir, 'a.js'));
  const names = fns.map((f) => f.name);
  assert.deepEqual(names.sort(), ['add', 'load', 'twice']);
  assert.deepEqual(scanFile(dir, path.join(dir, 'b.js')).map((f) => [f.name, f.access]), [['shown', 'prop']]);
  assert.deepEqual(scanFile(dir, path.join(dir, 'c.js')).map((f) => [f.name, f.access]), [['c', 'default']]);
  const add = fns.find((f) => f.name === 'add');
  assert.equal(add.doc, 'Adds.');
  assert.equal(add.nArgs, 2);
  assert.ok(fns.find((f) => f.name === 'load').impure.includes('fetch'));
});

test('python target scan and ranking on the fixture', () => {
  const fixture = path.resolve('test/fixtures/pylib');
  if (python.check(fixture, {}).ok === false) return;
  const targets = python.listTargets(fixture, {});
  const groups = planGroups(targets, { maxGroups: 10 });
  assert.equal(groups.length, 3);
  const codec = groups.find((g) => g.file === 'textkit/codec.py');
  assert.ok(codec.functions[0].why.some((w) => w.includes('inverse')));
  const only = planGroups(targets, { only: ['median'] });
  assert.deepEqual(only.map((g) => g.functions.map((f) => f.name)), [['median']]);
});

test('impure functions rank lower', () => {
  const base = { name: 'parse_config', doc: 'Parse it.', annotated: true, nArgs: 1, loc: 10, impure: [] };
  assert.ok(scoreTarget(base).score > scoreTarget({ ...base, impure: ['open', 'requests'] }).score);
});

test('relocateImports keeps relative imports working from a new folder', () => {
  const src = "import { a } from '../../../../src/a.js';\nimport fc from 'fast-check';";
  const out = relocateImports(src, '/r/.proofhound/runs/1/g01', '/r/.proofhound/runs/1/bugs/PH-001-x');
  assert.match(out, /from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/a\.js'/);
  assert.match(out, /from 'fast-check'/);
});

test('parseArgs', () => {
  const o = parseArgs(['src', '--only', 'a,b', '-j', '3', '--no-review', '--budget=2.5']);
  assert.deepEqual(o._, ['src']);
  assert.deepEqual(o.only, ['a', 'b']);
  assert.equal(o.jobs, 3);
  assert.equal(o.review, false);
  assert.equal(o.budget, 2.5);
  assert.throws(() => parseArgs(['--bogus']));
});

test('javascript adapter runs fast-check tests and extracts the counterexample', { skip: !fs.existsSync(path.join(os.homedir(), '.cache/proofhound/js/node_modules/fast-check')) && 'fast-check cache not installed' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-jsrun-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(dir, 'lib.js'), 'export function boom(x) { if (x > 5) return null.foo; return x; }\n');
  const work = path.join(dir, '.proofhound', 'w');
  fs.mkdirSync(work, { recursive: true });
  javascript.prepare(dir, path.join(dir, '.proofhound'));
  fs.writeFileSync(path.join(work, 'p.test.mjs'), "import test from 'node:test';\nimport fc from 'fast-check';\nimport { boom } from '../../lib.js';\ntest('never throws', () => { fc.assert(fc.property(fc.integer(), (x) => { boom(x); })); });\n");
  const r = await javascript.runTests(dir, {}, [path.join(work, 'p.test.mjs')], { cwd: dir });
  assert.equal(r.tests.length, 1);
  const e = r.tests[0].error;
  assert.equal(e.type, 'TypeError');
  assert.match(e.example, /Counterexample: \[6\]/);
  const c = classify(e, { repo: dir, workdir: work, lang: javascript });
  assert.equal(c.kind, 'crash');
  assert.equal(c.site.file, 'lib.js');
});
