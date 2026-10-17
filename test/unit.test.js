import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

test('rust scanner: pub fns, impl methods, FromStr, private modules, cfg(test)', async () => {
  const { rust } = await import('../src/lang/rust.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-rs-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'Cargo.toml'), '[package]\nname = "my-crate"\nversion = "0.1.0"\nedition = "2021"\n');
  fs.writeFileSync(path.join(dir, 'src', 'lib.rs'), `pub mod codec;\nmod hidden;\npub use hidden::Shown;\n
/// Adds.
pub fn add(a: i32, b: i32) -> i32 { a + b }
pub(crate) fn internal(x: u8) -> u8 { x }
fn private(x: u8) -> u8 { x }
pub struct Point { pub x: i32 }
impl Point {
    /// Makes a point.
    pub fn new(x: i32) -> Self { Point { x } }
    fn secret(&self) -> i32 { self.x }
    pub fn dist(&self, other: &Point) -> i32 {
        (self.x - other.x).abs()
    }
}
impl std::str::FromStr for Point {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, ()> { s.parse().map(|x| Point { x }).map_err(|_| ()) }
}
#[cfg(test)]
mod tests {
    pub fn helper(x: i32) -> i32 { x }
}
pub fn after_tests(s: &str) -> usize { s.len() }
`);
  fs.writeFileSync(path.join(dir, 'src', 'codec.rs'), 'pub fn encode(s: &str) -> String {\n    s.to_string()\n}\n');
  fs.writeFileSync(path.join(dir, 'src', 'hidden.rs'), 'pub struct Shown;\nimpl Shown {\n    pub fn go(&self, n: u8) -> u8 { n }\n}\npub fn not_exported(n: u8) -> u8 { n }\n');
  const ids = rust.listTargets(dir, {}).map((t) => `${t.id}/${t.nArgs}`).sort();
  assert.deepEqual(ids, ['my_crate::Point::dist/1', 'my_crate::Point::from_str/1', 'my_crate::Point::new/1', 'my_crate::add/2', 'my_crate::after_tests/1', 'my_crate::codec::encode/1', 'my_crate::hidden::Shown::go/1']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rust: proptest failures point at the panic inside the crate', async () => {
  const { parseRustFailure } = await import('../src/lang/rust.js');
  const section = `
thread 'ph_t' (12) panicked at /repo/src/lib.rs:29:6:
byte index 1 is not a char boundary
stack backtrace:
   0: __rustc::rust_begin_unwind
             at /rustc/abc/library/std/src/panicking.rs:689:5
   1: textkit::truncate
             at /repo/src/lib.rs:29:6
   2: ph_props::ph_t::{closure#1}
             at /repo/.proofhound/runs/x/g/ph_props.rs:12:17

thread 'ph_t' (12) panicked at /repo/.proofhound/runs/x/g/ph_props.rs:4:1:
Test failed: byte index 1 is not a char boundary.
minimal failing input: s = "é", n = 1
\tsuccesses: 0
`;
  const e = parseRustFailure(section, '/repo/.proofhound/runs/x/g');
  assert.equal(e.type, 'panic');
  assert.equal(e.message, 'byte index 1 is not a char boundary');
  assert.equal(e.frames.at(-1).file, '/repo/src/lib.rs');
  assert.equal(e.example, 'Failing test case: s = "é", n = 1');
});

test('go: goroutine traces and t.Fatalf output are parsed', async () => {
  const { parseGoFailure } = await import('../src/lang/go.js');
  const remap = new Map([['/repo/pkg/zz_proofhound_repro_x_test.go', '/repo/.proofhound/w/repro_x_test.go'], ['zz_proofhound_repro_x_test.go', '/repo/.proofhound/w/repro_x_test.go']]);
  const panic = parseGoFailure([
    '=== RUN   TestReproX\n', '--- FAIL: TestReproX (0.00s)\n', 'panic: runtime error: index out of range [-1] [recovered]\n', '\tpanic: runtime error: index out of range [-1]\n', '\n',
    'goroutine 18 [running]:\n', 'testing.tRunner.func1.2({0x6cbee0, 0xc0001ca078})\n', '\t/usr/local/go/src/testing/testing.go:1734 +0x21c\n',
    'panic({0x6cbee0?, 0xc0001ca078?})\n', '\t/usr/local/go/src/runtime/panic.go:792 +0x132\n',
    'example.com/m/pkg.Median({0x0?, 0x0?, 0x0?})\n', '\t/repo/pkg/m.go:42 +0xf9\n',
    'example.com/m/pkg.TestReproX(0xc000082700)\n', '\t/repo/pkg/zz_proofhound_repro_x_test.go:6 +0x1f\n',
  ], remap);
  assert.equal(panic.type, 'runtime.Error');
  assert.deepEqual(panic.frames.map((f) => `${f.file}:${f.line}`), ['/repo/.proofhound/w/repro_x_test.go:6', '/repo/pkg/m.go:42']);
  const fatal = parseGoFailure(['=== RUN   TestReproX\n', '    zz_proofhound_repro_x_test.go:9: got 2, want 1\n', '--- FAIL: TestReproX (0.00s)\n'], remap);
  assert.equal(fatal.type, 'AssertionError');
  assert.equal(fatal.message, 'got 2, want 1');
  assert.equal(fatal.frames[0].file, '/repo/.proofhound/w/repro_x_test.go');
});

test('go scanner lists exported functions and methods', { skip: spawnSync('go', ['version']).status !== 0 && 'needs go' }, async () => {
  const { go } = await import('../src/lang/go.js');
  const ids = go.listTargets(path.join(ROOT, 'test', 'fixtures', 'golib'), {}).map((t) => t.qualname);
  assert.deepEqual(ids, ['Chunk', 'Reverse', 'Median', 'EncodeRLE', 'DecodeRLE', 'Range.Contains', 'Range.Len', 'MustPositive']);
});

test('rust: assert! with a custom message in the test is an assertion, not a test bug', async () => {
  const { parseRustFailure } = await import('../src/lang/rust.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-rsa-'));
  const file = path.join(dir, 'repro_x.rs');
  fs.writeFileSync(file, '#[test]\nfn repro_x() {\n    assert!(f("1 30m").is_err(), "{:?}", f("1 30m"));\n    let v: Vec<i32> = vec![];\n    let _ = v[3];\n}\n');
  const at = (line, msg) => `\nthread 'repro_x' (7) panicked at ${file}:${line}:5:\n${msg}\nstack backtrace:\n   0: repro_x::repro_x\n             at ${file}:${line}:5\n`;
  assert.equal(parseRustFailure(at(3, 'Ok(7800s)'), dir).type, 'AssertionError');
  assert.equal(parseRustFailure(at(5, 'index out of bounds: the len is 0 but the index is 3'), dir).type, 'panic');
  fs.rmSync(dir, { recursive: true, force: true });
});
