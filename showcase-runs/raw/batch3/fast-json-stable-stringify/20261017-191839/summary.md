<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 1 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Cycles consisting only of arrays are not detected and cause a RangeError (stack overflow) <sub>(wrong result, index.js)</sub></summary>

| | |
|---|---|
| Function | `index (module.exports)` |
| Input | const a = []; a.push(a); index(a) and index(a, {cycles:true}) |
| Expected | index(a) throws TypeError; index(a, {cycles:true}) returns '["__cycle__"]' |
| Actual | RangeError: Maximum call stack size exceeded in both cases |
| Review | low severity, confidence 0.72 |

index.js returns from the Array.isArray branch (lines 29-36) before `seen` is checked or updated (lines 40-45), so an array that contains itself recurses until the stack overflows. Cycles that pass through an object are detected, either throwing TypeError or returning '__cycle__' when `opts.cycles` is true. The README documents `cycles`, and the library mirrors JSON.stringify, which throws TypeError for this input, so the pure-array case is inconsistent and ignores `cycles`. The README wording ('circular property') and the exact expected output '["__cycle__"]' are the reporter's extrapolation,

Failing test (`repro_array_cycle.test.mjs`, failed 3/3 runs):

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

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

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
</details>

<sub>1m06s · $0.25 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
