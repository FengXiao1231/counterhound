# remove() with a negative index and count > 1 corrupts the queue

| | |
|---|---|
| Function | `Denque.prototype.remove` in `index.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** new Denque([1,2,3,4]).remove(-3, 2)

**Expected:** returns [2,3] and the queue becomes [1,4]

**Actual:** queue is left with undefined holes and wrong contents

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import Denque from '../../../../../index.js';

test('repro_remove_negative', () => {
  const d = new Denque([1, 2, 3, 4]);
  assert.deepEqual(d.remove(-3, 2), [2, 3]);
  assert.deepEqual(d.toArray(), [1, 4]);
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

Run it with `node --test repro_remove_negative.test.mjs` (fix the import path if you move it).

## Why this is a bug

remove() accepts negative indices (i < -size check, i += size) but the later branches use the raw `index` (index + count === size, index === 0, index < 0) instead of the normalised i.

Independent review: remove() explicitly accepts negative indices (`i < -size` check, then `i += size`). After that, the multi-item branches still test and use the raw `index` (`index + count === size`, `index === 0`, `this._head + index + count`, `index < 0`) instead of the normalised `i`. For `remove(-3, 2)` on [1,2,3,4], none of the fast paths match and the middle-removal branch uses a negative `index`. That leaves `undefined` holes and wrong contents, as the repro shows. The `count === 1` path uses the normalised `i` and works, and positive indices are unaffected, so this is an incomplete normalisation that a maintainer would fix.

## How it was found

Property: *remove(i, n) behaves like Array.prototype.splice(i, n), including negative i*.

fast-check shrank the failure to: `Counterexample: [[0,0],[["remove",-1,2]]]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
