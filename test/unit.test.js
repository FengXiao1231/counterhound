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
  fs.writeFileSync(path.join(dir, 'd.js'), `export default function decamelize(\n  text,\n  { separator = '_' } = {},\n) {\n  const x = 1;\n  return text + separator + x;\n}\n`);
  assert.deepEqual(scanFile(dir, path.join(dir, 'd.js')).map((f) => [f.name, f.nArgs, f.loc]), [['decamelize', 2, 7]]);
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
  fs.writeFileSync(path.join(dir, 'src', 'glob.rs'), 'pub struct Pat<const A: char>;\nimpl<const A: char>\n    Pat<A>\n{\n    pub fn is_match(&self, s: &str) -> bool { s.contains(A) }\n}\n');
  fs.appendFileSync(path.join(dir, 'src', 'lib.rs'), 'mod glob;\npub use glob::*;\n');
  const ids = rust.listTargets(dir, {}).map((t) => `${t.id}/${t.nArgs}`).sort();
  assert.deepEqual(ids, ['my_crate::Point::dist/1', 'my_crate::Point::from_str/1', 'my_crate::Point::new/1', 'my_crate::add/2', 'my_crate::after_tests/1', 'my_crate::codec::encode/1', 'my_crate::glob::Pat::is_match/1', 'my_crate::hidden::Shown::go/1']);
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

test('diff mode: changed line ranges select the functions they touch', async () => {
  const { parseDiff, touchedTargets, changedLines } = await import('../src/diff.js');
  const d = parseDiff(`diff --git a/x.py b/x.py
--- a/x.py
+++ b/x.py
@@ -3,0 +4,2 @@ def a():
+    y = 1
+    z = 2
@@ -20 +22 @@ def c():
-    return 1
+    return 2
diff --git a/old.py b/old.py
--- a/old.py
+++ /dev/null
`);
  assert.deepEqual([...d.entries()], [['x.py', [[4, 5], [22, 22]]]]);
  const t = (name, line, loc) => ({ file: 'x.py', name, line, loc });
  assert.deepEqual(touchedTargets([t('a', 1, 6), t('b', 8, 10), t('c', 20, 5), { ...t('d', 1, 30), file: 'y.py' }], d).map((x) => x.name), ['a', 'c']);

  // against a real repository, in a subdirectory
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-diff-'));
  const git = (...a) => { const r = spawnSync('git', a, { cwd: dir, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git('init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(dir, 'pkg'));
  fs.writeFileSync(path.join(dir, 'pkg', 'm.py'), 'def a():\n    return 1\n\n\ndef b():\n    return 2\n');
  git('add', '.'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
  git('checkout', '-qb', 'feature');
  fs.writeFileSync(path.join(dir, 'pkg', 'm.py'), 'def a():\n    return 1\n\n\ndef b():\n    return 3\n');
  const ch = changedLines(path.join(dir, 'pkg'), 'main');
  assert.deepEqual([...ch.entries()], [['m.py', [[6, 6]]]]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('PR summary lists confirmed bugs with their repro, and says when nothing changed', async () => {
  const { summaryMarkdown, MARKER } = await import('../src/report/summary.js');
  const bug = {
    status: 'confirmed', bugId: 'PH-001', title: 't', function: 'm.chunk', file: 'm.py', input: 'chunk([1], 2)', expected: '[[1]]', actual: '[]',
    reproSource: 'def test_repro():\n    assert chunk([1], 2) == [[1]]\n',
    verification: { kind: 'assertion', reproFile: 'test_repro.py', runs: 3, error: { type: 'AssertionError', message: '' } },
    review: { verdict: 'bug', confidence: 0.9, severity: 'medium', title: 'chunk() drops | the last chunk', reason: 'Documented.' },
  };
  const counts = { modules: 1, functions: 2, reported: 2, verified: 1, duplicates: 0, confirmed: 1 };
  const md = summaryMarkdown({ lang: 'python', counts, findings: [bug], ms: 1000, spend: { usd: 0.2 }, diff: { base: 'main', files: 1 } }, { reportUrl: 'https://x/run' });
  assert.ok(md.startsWith(MARKER));
  assert.match(md, /found 1 provable bug/);
  assert.match(md, /2 changed functions in 1 module/);
  assert.match(md, /chunk\(\) drops \\\| the last chunk/);
  assert.match(md, /```python\ndef test_repro/);
  assert.match(md, /\[full report\]\(https:\/\/x\/run\)/);
  const none = summaryMarkdown({ lang: 'python', counts: { ...counts, functions: 0, modules: 0, confirmed: 0 }, findings: [], ms: 0, diff: { base: 'main', files: 3 } });
  assert.match(none, /nothing to check/);
});

test('PR comment: updates the earlier proofhound comment, skips clean runs when asked', async () => {
  const http = await import('node:http');
  const { postComment } = await import('../src/github.js');
  const { MARKER } = await import('../src/report/summary.js');
  const calls = [];
  let comments = [{ id: 1, body: 'lgtm' }];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      calls.push(`${req.method} ${req.url}`);
      assert.equal(req.headers.authorization, 'Bearer tok');
      if (req.method === 'GET') { res.end(JSON.stringify(comments)); return; }
      res.end(JSON.stringify({ id: 2, ...JSON.parse(body) }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const env = { GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'o/r', PROOFHOUND_PR: '7', GITHUB_API_URL: `http://127.0.0.1:${server.address().port}` };
  try {
    assert.equal(await postComment(`${MARKER}\nclean`, { env, onlyIfBugs: true, hasBugs: false }), 'skipped');
    assert.equal(await postComment(`${MARKER}\nbugs`, { env, onlyIfBugs: true, hasBugs: true }), 'created');
    comments = [{ id: 1, body: 'lgtm' }, { id: 9, body: `${MARKER}\nbugs` }];
    assert.equal(await postComment(`${MARKER}\nclean now`, { env, onlyIfBugs: true, hasBugs: false }), 'updated');
    assert.deepEqual(calls, [
      'GET /repos/o/r/issues/7/comments?per_page=100&page=1',
      'GET /repos/o/r/issues/7/comments?per_page=100&page=1', 'POST /repos/o/r/issues/7/comments',
      'GET /repos/o/r/issues/7/comments?per_page=100&page=1', 'PATCH /repos/o/r/issues/comments/9',
    ]);
  } finally { server.close(); }
});

test('java scanner: public methods of public top-level classes, javadoc, instance vs static', async () => {
  const { java } = await import('../src/lang/java.js');
  const t = java.listTargets(path.join(ROOT, 'test', 'fixtures', 'javalib'), {});
  const by = Object.fromEntries(t.map((x) => [x.qualname, x]));
  assert.deepEqual(Object.keys(by).sort(), ['Range.contains', 'Range.length', 'TextKit.chunk', 'TextKit.decodeRle', 'TextKit.encodeRle', 'TextKit.median', 'TextKit.midpoint', 'TextKit.parsePercent', 'TextKit.reverse']);
  assert.equal(by['TextKit.chunk'].static, true);
  assert.equal(by['TextKit.chunk'].nArgs, 2);
  assert.equal(by['Range.contains'].static, false);
  assert.match(by['TextKit.chunk'].doc, /Concatenating the chunks gives back xs/);
  assert.equal(by['TextKit.median'].module, 'com.example.textkit.TextKit');
});

test('java: QuickTheories causes and JDK frames are attributed to the calling project frame', async () => {
  const { parseJavaTrace } = await import('../src/lang/java.js');
  const text = `java.lang.AssertionError: Property falsified after 1 example(s) 
Smallest found falsifying value(s) :-
[]
Cause was :-
java.lang.NumberFormatException: For input string: ""
\tat java.base/java.lang.NumberFormatException.forInputString(NumberFormatException.java:67)
\tat java.base/java.lang.Integer.parseInt(Integer.java:672)
\tat com.x.Codec.decode(Codec.java:12)
\tat com.x.PhPropsTest.lambda$rt$0(PhPropsTest.java:9)
\tat org.quicktheories.impl.Core.run(Core.java:35)`;
  const files = { 'Codec.java': '/r/src/main/java/com/x/Codec.java', 'PhPropsTest.java': '/r/.proofhound/w/PhPropsTest.java' };
  const e = parseJavaTrace(text, (cls, file) => (cls.startsWith('com.x.') ? files[file] : null));
  assert.equal(e.type, 'java.lang.NumberFormatException');
  assert.equal(e.message, 'For input string: ""');
  assert.equal(e.example, 'Failing test case: []');
  assert.deepEqual(e.frames.map((f) => `${f.file}:${f.line}`), ['/r/.proofhound/w/PhPropsTest.java:9', '/r/src/main/java/com/x/Codec.java:12']);
  assert.equal(parseJavaTrace('org.opentest4j.AssertionFailedError: expected: <1> but was: <2>\n\tat com.x.T.t(T.java:3)', () => null).type, 'AssertionError');
});
