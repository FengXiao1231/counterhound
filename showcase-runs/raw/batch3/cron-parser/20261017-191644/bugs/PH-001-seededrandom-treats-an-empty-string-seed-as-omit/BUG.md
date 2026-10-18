# seededRandom('') treats an empty-string seed as omitted and returns a non-deterministic generator

| | |
|---|---|
| Function | `seededRandom` in `src/utils/random.ts` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** seededRandom('') called twice

**Expected:** Both generators yield the same sequence, since a seed string was provided (only an omitted seed should be random)

**Actual:** '' is falsy, so `str ? ... : Math.random()` picks a random seed and the sequences differ

## Reproduce

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

Fails with `AssertionError: Expected values to be strictly deep-equal:`

Run it with `node --test repro_empty_seed.test.mjs` (fix the import path if you move it).

## Suggested fix

The repro passes with this patch; the project's tests passed (npm test --silent). Apply it with `git apply fix.patch`.

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

## Why this is a bug

Docstring: 'When not provided, the seed is randomly generated'; param type is `str?: string`, and '' is a provided string. Every other string seed is deterministic; the check should be `str === undefined`.

Independent review: The docstring says the seed is random only 'when not provided', and the parameter is typed `str?: string`. The check `str ? ... : Math.random()` is a truthiness test, so a provided '' is treated like undefined. Every other string seed gives a deterministic sequence, and `hashSeed: ''` passed through CronExpressionParser.parse silently loses reproducibility. A maintainer would probably accept a one-line `str === undefined` fix, but '' is an edge-case seed and nothing in the tests or README promises how it behaves, so severity is low.

## How it was found

Property: *two generators created with the same provided seed string produce identical sequences*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
