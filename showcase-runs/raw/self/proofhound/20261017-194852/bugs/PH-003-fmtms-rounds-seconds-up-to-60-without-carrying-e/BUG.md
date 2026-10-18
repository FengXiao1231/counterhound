# fmtMs rounds seconds up to 60 without carrying (e.g. '1m60s', '60s')

| | |
|---|---|
| Function | `fmtMs` in `src/util.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** 119500 (also 59600)

**Expected:** '2m00s' (and '1m00s' for 59600)

**Actual:** '1m60s' (and '60s')

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtMs } from '../../../../../src/util.js';
test('repro_fmtms_rounding', () => {
  assert.notEqual(fmtMs(119500), '1m60s');
  assert.notEqual(fmtMs(59600), '60s');
});
```

Fails with `AssertionError: Expected "actual" to be strictly unequal to:`

Run it with `node --test repro_fmtms_rounding.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

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

## Why this is a bug

Time formats NmSS must have seconds in 00-59; Math.round(s % 60) and toFixed(0) can reach 60 without carrying.

Independent review: In src/util.js, `fmtMs(119500)` floors minutes to 1 and then applies `Math.round(59.5)` to the seconds, which gives '1m60s' instead of '2m00s'. For `fmtMs(59600)`, `(59.6).toFixed(0)` gives '60s' instead of '1m00s'. The function formats durations as NmSS, where seconds are 00-59, so these outputs are invalid. The repro uses the function correctly and involves no float artefact. The fix is small: round the total to whole seconds before splitting into minutes and seconds. This is cosmetic, since it only affects log and report timing strings.

## How it was found

Property: *formatted seconds component is always < 60*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
