# format() rounds negative half-unit values toward +infinity, giving '-1 seconds' for -1500 ms

| | |
|---|---|
| Function | `format` in `src/index.ts` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** format(-1500) and format(-1500, {long:true})

**Expected:** '-2s' and '-2 seconds' (mirroring format(1500) === '2s')

**Actual:** '-1s'; long form gives '-1 seconds' (plural suffix chosen from |ms| >= 1.5*unit, but number rounded by Math.round to -1)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from '../../../../../src/index.ts';

test('repro_negative_half_rounding', () => {
  assert.equal(format(1500), '2s');
  assert.equal(format(-1500), '-2s');
  assert.equal(format(-1500, { long: true }), '-2 seconds');
});
```

Fails with `AssertionError: Expected values to be strictly equal:`

## Why this is a bug

Math.round(-1.5) === -1 whereas Math.round(1.5) === 2; the plural() helper uses msAbs for pluralization, so it intends symmetric handling of negatives, yet yields ungrammatical '-1 seconds' vs '2 seconds' for the positive.

Independent review: In src/index.ts, fmtShort and plural() decide the unit and the plural suffix from msAbs, but round the signed value with Math.round(ms / n). For -1500 the suffix logic treats the value as 1.5 or more and adds 's', while Math.round(-1.5) gives -1, so the output is '-1 seconds' (and '-1s'), where 1500 gives '2 seconds' ('2s'). Existing tests cover negatives only at non-half values, so nothing contradicts a fix. The fix is tiny (round the absolute value and reapply the sign). The impact is cosmetic and limited to exact .5 boundaries, so a maintainer might defer it.

## How it was found

Property: *format(-n) === '-' + format(n) for positive n*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
