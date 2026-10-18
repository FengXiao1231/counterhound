# parseGoJson attributes a package-level panic to every earlier failed test, not just the unfinished one

| | |
|---|---|
| Function | `parseGoJson` in `src/lang/go.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** TestA: output '    a_test.go:3: got 1, want 2' then fail; TestB: run only; package-level output 'panic: boom'

**Expected:** TestA error = AssertionError 'got 1, want 2' (only the unfinished TestB may take the panic)

**Actual:** TestA error is re-parsed from its lines plus the package output and becomes type 'panic', message 'boom'

## Reproduce

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

Fails with `AssertionError: Expected values to be strictly equal:`

Run it with `node --test repro_sibling_panic.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

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

## Why this is a bug

The comment says 'a panic printed after the test's own lines lands in package output', i.e. it is meant for the test that was running; but the condition only checks outcome === 'failed' and that the test's own lines lack 'panic:', so every failed test with a t.Error is overwritten.

Independent review: The override at go.js:154 only checks that outcome is 'failed', that the test's own lines lack 'panic:', and that package output contains 'panic:'. It never checks whether the test finished. In `go test -json`, tests run sequentially, so a test that already got an explicit `fail` event has finished and cannot have caused a later panic. Its genuine t.Error message is replaced with type 'panic' and the other test's message. The code comment says the panic belongs to the test that was running, which is only the test with no outcome (the one set to 'failed' at line 147). Restricting the override to tests that had no explicit fail/pass event is a small fix a maintainer would accept. The repro matches the code path.

## How it was found

Property: *a test that finished with an explicit fail event keeps its own assertion error even if a different test later panics in package output*.

fast-check shrank the failure to: `Counterexample: ["a","b"]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
