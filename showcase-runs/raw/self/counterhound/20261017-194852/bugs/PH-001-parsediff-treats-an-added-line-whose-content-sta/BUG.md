# parseDiff treats an added line whose content starts with '++ ' as a new file header

| | |
|---|---|
| Function | `parseDiff` in `src/diff.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** --- a/a.txt
+++ b/a.txt
@@ -4,0 +5 @@
+++ x
@@ -9,0 +11 @@
+y


**Expected:** Map { 'a.txt' => [[5,5],[11,11]] }

**Actual:** '+++ x' (an added line with content '++ x') is parsed as a file header: file becomes 'x', a bogus entry 'x' is created and the later hunk is attributed to it, so a.txt loses range [11,11]

## Reproduce

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

Fails with `AssertionError: Expected values to be strictly deep-equal:`

Run it with `node --test repro_added_line_looks_like_header.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

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

## Why this is a bug

parseDiff is documented to parse git diff --unified=0 into file -> new-side ranges; with unified=0 added lines are printed as '+' + content, so content '++ x' yields '+++ x' inside a hunk. The parser does not track hunk line counts, so it cannot tell it from a header. Changed functions in the real file can be missed in diff mode.

Independent review: parseDiff checks `^\+\+\+ ` on every line and never tracks hunk line counts or the preceding `---` line. A real `git diff --unified=0` prints an added line with content `++ x` as `+++ x` inside a hunk. The parser then switches `file` to 'x', creates a bogus entry, and attributes all later hunks to it, so the real file loses ranges. The input is valid git output, and the expected result follows from the function's documented purpose of mapping each file to its new-side ranges. Diff mode could then skip changed functions, and a maintainer would accept a fix that consumes hunk bodies by count or only accepts `+++` right after a `---` line.

## How it was found

Property: *an added line inside a hunk never changes the current file; changed ranges stay attributed to the right file*.

fast-check shrank the failure to: `Counterexample: ["a",1]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
