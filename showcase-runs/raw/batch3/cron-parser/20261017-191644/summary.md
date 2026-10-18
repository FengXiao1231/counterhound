<!-- proofhound-report -->
### proofhound found 1 provable bug (1 with a verified fix)

Checked 1 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> seededRandom('') treats an empty-string seed as omitted and returns a non-deterministic generator <sub>(wrong result, src/utils/random.ts)</sub></summary>

| | |
|---|---|
| Function | `seededRandom` |
| Input | seededRandom('') called twice |
| Expected | Both generators yield the same sequence, since a seed string was provided (only an omitted seed should be random) |
| Actual | '' is falsy, so `str ? ... : Math.random()` picks a random seed and the sequences differ |
| Review | low severity, confidence 0.60 |

The docstring says the seed is random only 'when not provided', and the parameter is typed `str?: string`. The check `str ? ... : Math.random()` is a truthiness test, so a provided '' is treated like undefined. Every other string seed gives a deterministic sequence, and `hashSeed: ''` passed through CronExpressionParser.parse silently loses reproducibility. A maintainer would probably accept a one-line `str === undefined` fix, but '' is an edge-case seed and nothing in the tests or README promises how it behaves, so severity is low.

Failing test (`repro_empty_seed.test.mjs`, failed 3/3 runs):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom } from '../../../../../src/utils/random.ts';

test('repro_empty_seed', () => {
  const a = seededRandom('');
  const b = seededRandom('');
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
```

Suggested fix (the repro passes with it; project tests passed (npm test --silent)):

```diff
diff --git a/src/utils/random.ts b/src/utils/random.ts
index acde34e..8479605 100644
--- a/src/utils/random.ts
+++ b/src/utils/random.ts
@@ -37,6 +37,6 @@ function mulberry32(seed: number) {
  * @returns {PRNG} A random number generator correctly seeded
  */
 export function seededRandom(str?: string): PRNG {
-  const seed = str ? xfnv1a(str)() : Math.floor(Math.random() * 10_000_000_000);
+  const seed = str !== undefined ? xfnv1a(str)() : Math.floor(Math.random() * 10_000_000_000);
   return mulberry32(seed);
 }
```
</details>

<sub>1m36s · $0.22 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
