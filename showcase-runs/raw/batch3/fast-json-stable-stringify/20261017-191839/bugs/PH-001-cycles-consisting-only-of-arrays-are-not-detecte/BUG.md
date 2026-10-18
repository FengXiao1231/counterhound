# Cycles consisting only of arrays are not detected and cause a RangeError (stack overflow)

| | |
|---|---|
| Function | `index (module.exports)` in `index.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.72, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** const a = []; a.push(a); index(a) and index(a, {cycles:true})

**Expected:** index(a) throws TypeError; index(a, {cycles:true}) returns '["__cycle__"]'

**Actual:** RangeError: Maximum call stack size exceeded in both cases

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import index from '../../../../../index.js';

test('repro_array_cycle', () => {
  const a = []; a.push(a);
  assert.throws(() => index(a), TypeError);
  assert.equal(index(a, { cycles: true }), '["__cycle__"]');
});
```

Fails with `AssertionError: The error is expected to be an instance of "TypeError". Received "RangeError"`

Run it with `node --test repro_array_cycle.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

```diff
diff --git a/index.js b/index.js
index c44e6a4..8a4bd91 100644
--- a/index.js
+++ b/index.js
@@ -26,23 +26,24 @@ module.exports = function (data, opts) {
         if (typeof node !== 'object') return JSON.stringify(node);
 
         var i, out;
+        if (node === null) return 'null';
+
+        if (seen.indexOf(node) !== -1) {
+            if (cycles) return JSON.stringify('__cycle__');
+            throw new TypeError('Converting circular structure to JSON');
+        }
+
+        var seenIndex = seen.push(node) - 1;
         if (Array.isArray(node)) {
             out = '[';
             for (i = 0; i < node.length; i++) {
                 if (i) out += ',';
                 out += stringify(node[i]) || 'null';
             }
+            seen.splice(seenIndex, 1);
             return out + ']';
         }
 
-        if (node === null) return 'null';
-
-        if (seen.indexOf(node) !== -1) {
-            if (cycles) return JSON.stringify('__cycle__');
-            throw new TypeError('Converting circular structure to JSON');
-        }
-
-        var seenIndex = seen.push(node) - 1;
         var keys = Object.keys(node).sort(cmp && cmp(node));
         out = '';
         for (i = 0; i < keys.length; i++) {
```

## Why this is a bug

README documents the cycles option (cycle detection returns '__cycle__', otherwise TypeError as in JSON.stringify). Code only records objects in `seen` after the Array.isArray branch returns, so arrays are never tracked.

Independent review: index.js returns from the Array.isArray branch (lines 29-36) before `seen` is checked or updated (lines 40-45), so an array that contains itself recurses until the stack overflows. Cycles that pass through an object are detected, either throwing TypeError or returning '__cycle__' when `opts.cycles` is true. The README documents `cycles`, and the library mirrors JSON.stringify, which throws TypeError for this input, so the pure-array case is inconsistent and ignores `cycles`. The README wording ('circular property') and the exact expected output '["__cycle__"]' are the reporter's extrapolation, and it is an edge case that throws either way, which is why severity is low. A small fix (track arrays in `seen`) would be accepted.

## How it was found

Property: *A circular structure either throws TypeError('Converting circular structure to JSON') or, with opts.cycles true, yields '__cycle__' in place of the cycle*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
