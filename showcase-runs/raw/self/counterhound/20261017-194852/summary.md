<!-- counterhound-report -->
### counterhound found 6 provable bugs (3 with a verified fix)

Checked 22 functions in 6 modules with property-based tests. 7 reported → 7 reproduced → 7 unique → 6 confirmed by an independent review.

<details><summary><b>PH-001</b> parseDiff treats an added line whose content starts with '++ ' as a new file header <sub>(wrong result, src/diff.js)</sub></summary>

| | |
|---|---|
| Function | `parseDiff` |
| Input | --- a/a.txt +++ b/a.txt @@ -4,0 +5 @@ +++ x @@ -9,0 +11 @@ +y  |
| Expected | Map { 'a.txt' => [[5,5],[11,11]] } |
| Actual | '+++ x' (an added line with content '++ x') is parsed as a file header: file becomes 'x', a bogus entry 'x' is created and the later hunk is attributed to it, s |
| Review | medium severity, confidence 0.90 |

parseDiff checks `^\+\+\+ ` on every line and never tracks hunk line counts or the preceding `---` line. A real `git diff --unified=0` prints an added line with content `++ x` as `+++ x` inside a hunk. The parser then switches `file` to 'x', creates a bogus entry, and attributes all later hunks to it, so the real file loses ranges. The input is valid git output, and the expected result follows from the function's documented purpose of mapping each file to its new-side ranges. Diff mode could then skip changed functions, and a maintainer would accept a fix that consumes hunk bodies by count or 

Failing test (`repro_added_line_looks_like_header.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from '../../../../../src/diff.js';

test('repro_added_line_looks_like_header', () => {
  // a.txt gains the line "++ x" at line 5; git prints it as "+++ x" inside the hunk
  const diff = [
    'diff --git a/a.txt b/a.txt',
    '--- a/a.txt',
    '+++ b/a.txt',
    '@@ -4,0 +5 @@',
    '+++ x',
    '@@ -9,0 +11 @@',
    '+y',
    '',
  ].join('\n');
  assert.deepEqual([...parseDiff(diff)], [['a.txt', [[5, 5], [11, 11]]]]);
});
```

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

```diff
diff --git a/src/diff.js b/src/diff.js
index 2951233..b0c7de8 100644
--- a/src/diff.js
+++ b/src/diff.js
@@ -25,14 +25,21 @@ export function changedLines(repo, base) {
 export function parseDiff(text) {
   const out = new Map();
   let file = null;
+  let oldLeft = 0, newLeft = 0; // hunk body lines still to consume, so '+++ x' content isn't read as a header
   for (const line of text.split('\n')) {
     let m;
-    if ((m = line.match(/^\+\+\+ (?:b\/)?(.*)$/))) {
+    if (oldLeft > 0 && line[0] === '-') {
+      oldLeft--;
+    } else if (newLeft > 0 && line[0] === '+') {
+      newLeft--;
+    } else if ((m = line.match(/^\+\+\+ (?:b\/)?(.*)$/))) {
       file = m[1] === '/dev/null' ? null : m[1];
       if (file && !out.has(file)) out.set(file, []);
-    } else if (file && (m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/))) {
-      const start = +m[1];
-      const count = m[2] === undefined ? 1 : +m[2];
+    } else if (file && (m = line.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/))) {
+      const start = +m[2];
+      const count = m[3] === undefined ? 1 : +m[3];
+      oldLeft = m[1] === undefined ? 1 : +m[1];
+      newLeft = count;
       // a pure deletion (count 0) still changes the function around it
       out.get(file).push(count === 0 ? [start, start + 1] : [start, start + count - 1]);
     }
```
</details>

<details><summary><b>PH-002</b> parseGoJson attributes a package-level panic to every earlier failed test, not just the unfinished one <sub>(wrong result, src/lang/go.js)</sub></summary>

| | |
|---|---|
| Function | `parseGoJson` |
| Input | TestA: output ' a_test.go:3: got 1, want 2' then fail; TestB: run only; package-level output 'panic: boom' |
| Expected | TestA error = AssertionError 'got 1, want 2' (only the unfinished TestB may take the panic) |
| Actual | TestA error is re-parsed from its lines plus the package output and becomes type 'panic', message 'boom' |
| Review | medium severity, confidence 0.80 |

The override at go.js:154 only checks that outcome is 'failed', that the test's own lines lack 'panic:', and that package output contains 'panic:'. It never checks whether the test finished. In `go test -json`, tests run sequentially, so a test that already got an explicit `fail` event has finished and cannot have caused a later panic. Its genuine t.Error message is replaced with type 'panic' and the other test's message. The code comment says the panic belongs to the test that was running, which is only the test with no outcome (the one set to 'failed' at line 147). Restricting the override t

Failing test (`repro_sibling_panic.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoJson } from '../../../../../src/lang/go.js';

test('repro_sibling_panic', () => {
  const stdout = [
    { Action: 'run', Test: 'TestA' },
    { Action: 'output', Test: 'TestA', Output: '    a_test.go:3: got 1, want 2\n' },
    { Action: 'fail', Test: 'TestA' },
    { Action: 'run', Test: 'TestB' },
    { Action: 'output', Output: 'panic: boom\n' },
    { Action: 'output', Output: 'FAIL\n' },
  ].map((e) => JSON.stringify(e)).join('\n');
  const { tests } = parseGoJson(stdout, new Map());
  const a = tests.find((t) => t.name === 'TestA');
  assert.equal(a.error.type, 'AssertionError');
  assert.equal(a.error.message, 'got 1, want 2');
});
```

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

```diff
diff --git a/src/lang/go.js b/src/lang/go.js
index b29cc78..fe8a7e2 100644
--- a/src/lang/go.js
+++ b/src/lang/go.js
@@ -144,14 +144,15 @@ export function parseGoJson(stdout, remap) {
   }
   const out = [];
   for (const t of tests.values()) {
-    if (!t.outcome) t.outcome = 'failed'; // the binary died while this test was running
+    const unfinished = !t.outcome;
+    if (unfinished) t.outcome = 'failed'; // the binary died while this test was running
     out.push({
       id: t.name, name: t.name, outcome: t.outcome,
       error: t.outcome === 'failed' ? parseGoFailure(t.lines, remap) : null,
       longrepr: t.outcome === 'failed' ? t.lines.join('').slice(-6000) : null,
     });
     // a panic printed after the test's own lines lands in package output
-    if (t.outcome === 'failed' && !t.lines.join('').includes('panic:') && pkgFailOutput.join('').includes('panic:')) {
+    if (unfinished && !t.lines.join('').includes('panic:') && pkgFailOutput.join('').includes('panic:')) {
       out[out.length - 1].error = parseGoFailure([...t.lines, ...pkgFailOutput], remap);
     }
   }
```
</details>

<details><summary><b>PH-003</b> fmtMs rounds seconds up to 60 without carrying (e.g. '1m60s', '60s') <sub>(wrong result, src/util.js)</sub></summary>

| | |
|---|---|
| Function | `fmtMs` |
| Input | 119500 (also 59600) |
| Expected | '2m00s' (and '1m00s' for 59600) |
| Actual | '1m60s' (and '60s') |
| Review | low severity, confidence 0.90 |

In src/util.js, `fmtMs(119500)` floors minutes to 1 and then applies `Math.round(59.5)` to the seconds, which gives '1m60s' instead of '2m00s'. For `fmtMs(59600)`, `(59.6).toFixed(0)` gives '60s' instead of '1m00s'. The function formats durations as NmSS, where seconds are 00-59, so these outputs are invalid. The repro uses the function correctly and involves no float artefact. The fix is small: round the total to whole seconds before splitting into minutes and seconds. This is cosmetic, since it only affects log and report timing strings.

Failing test (`repro_fmtms_rounding.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtMs } from '../../../../../src/util.js';
test('repro_fmtms_rounding', () => {
  assert.notEqual(fmtMs(119500), '1m60s');
  assert.notEqual(fmtMs(59600), '60s');
});
```

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

```diff
diff --git a/src/util.js b/src/util.js
index d2354e6..5ae09b1 100644
--- a/src/util.js
+++ b/src/util.js
@@ -93,9 +93,10 @@ export function hash(s, n = 10) {
 export function fmtMs(ms) {
   if (ms == null || Number.isNaN(ms)) return '–';
   const s = ms / 1000;
-  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
-  const m = Math.floor(s / 60);
-  return `${m}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
+  const total = Math.round(s);
+  if (total < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
+  const m = Math.floor(total / 60);
+  return `${m}m${String(total % 60).padStart(2, '0')}s`;
 }
 
 export function fmtUsd(v) {
```
</details>

<details><summary><b>PH-004</b> relPath returns the absolute path for children whose name starts with '..' <sub>(wrong result, src/util.js)</sub></summary>

| | |
|---|---|
| Function | `relPath` |
| Input | relPath('/root', '/root/..foo/a.js') |
| Expected | '..foo/a.js' |
| Actual | '/root/..foo/a.js' (absolute path returned) |
| Review | low severity, confidence 0.90 |

`relPath` in src/util.js:144 uses `r.startsWith('..')` to detect paths outside the root. `path.relative('/root', '/root/..foo/a.js')` returns `'..foo/a.js'`, which is inside the root, so `relPath` wrongly falls back to the absolute path. Valid names like `..foo` or `...` are rare, but a maintainer would accept the one-line fix of checking `r === '..' \|\| r.startsWith('..' + path.sep)`. I did not run the repro myself; I confirmed the cause by reading the source.

Failing test (`repro_relpath_dotdot_name.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { relPath } from '../../../../../src/util.js';
test('repro_relpath_dotdot_name', () => {
  assert.equal(relPath('/root', '/root/..foo/a.js'), '..foo/a.js');
});
```
</details>

<details><summary><b>PH-005</b> parseJavaTrace does not cut off tab-indented 'Suppressed:' sections, so their frames are attributed to the primary exception <sub>(wrong result, src/lang/java.js)</sub></summary>

| | |
|---|---|
| Function | `parseJavaTrace` |
| Input | java.lang.RuntimeException: boom\n\tat p.A.run(A.java:3)\n\tSuppressed: java.io.IOException: x\n\t\tat p.B.close(B.java:9)\n |
| Expected | frames only for A.java (the code splits the trace at Caused by/Suppressed to keep only the primary exception) |
| Actual | frames contains both A.java and B.java, because the split regex /\n(?:Caused by\|Suppressed): / requires the keyword at column 0 |
| Review | low severity, confidence 0.85 |

src/lang/java.js:217 splits on /\n(?:Caused by\|Suppressed): / to keep only the primary exception. Throwable.printStackTrace indents suppressed exceptions with a tab ('\tSuppressed: ...'), and a cause nested inside a suppressed exception is also indented. So the Suppressed branch of the regex can never match real JVM output, and the frame regex (/^\s*at .../gm) then collects the suppressed exception's frames. The repro is valid, and the intent is clear from the code. Changing the split to /\n\s*(?:Caused by\|Suppressed): / is a small, safe fix that a maintainer would accept. Impact is limited 

Failing test (`repro_suppressed.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJavaTrace } from '../../../../../src/lang/java.js';

test('repro_suppressed', () => {
  const t = 'java.lang.RuntimeException: boom\n\tat p.A.run(A.java:3)\n\tSuppressed: java.io.IOException: x\n\t\tat p.B.close(B.java:9)\n';
  const r = parseJavaTrace(t, (c, f) => '/p/' + f);
  assert.deepEqual(r.frames.map((f) => f.file), ['/p/A.java']);
});
```
</details>

<details><summary><b>PH-006</b> extractJSON prefers '{' over '[' regardless of position, so an array of objects in prose returns its first element <sub>(wrong result, src/util.js)</sub></summary>

| | |
|---|---|
| Function | `extractJSON` |
| Input | Result: [{"a":1},{"b":2}] |
| Expected | [{a:1},{b:2}] |
| Actual | {a:1} (the first object; '{' is searched before '[' regardless of position) |
| Review | low severity, confidence 0.85 |

The docstring promises the first JSON object/array in the text. The loop in src/util.js:130 tries '{' before '[' without comparing positions. For `Result: [{"a":1},{"b":2}]`, whole-text parsing fails, the '{' pass then parses the first inner object, and the enclosing array is silently truncated. The existing tests don't catch this: the fenced array case succeeds through the direct JSON.parse of the fence contents, and the prose case only uses an object. A fix is trivial (try whichever opener comes first, falling back to the other), so a maintainer would accept it. Impact is limited because the

Failing test (`repro_extractjson_array_of_objects.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJSON } from '../../../../../src/util.js';
test('repro_extractjson_array_of_objects', () => {
  assert.deepEqual(extractJSON('Result: [{"a":1},{"b":2}]'), [{ a: 1 }, { b: 2 }]);
});
```
</details>

1 more failure reproduced, but the reviewer was not sure it is a bug: parseLibtest drops #[should_panic] tests (failures go unreported).

<sub>5m06s · $1.55 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
