# removeOne() with a negative index corrupts the queue because the branch choice uses the un-normalised index

| | |
|---|---|
| Function | `Denque.prototype.removeOne` in `index.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** new Denque([1,2]).removeOne(-1)

**Expected:** returns 2 and the queue becomes [1]

**Actual:** returns 2 but the queue becomes [undefined, 1]-like corrupted state (the front slot is cleared and head advanced instead of removing the last item)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import Denque from '../../../../../index.js';

test('repro_removeone_negative', () => {
  const d = new Denque([1, 2]);
  assert.equal(d.removeOne(-1), 2);
  assert.deepEqual(d.toArray(), [1]);
});
```

Fails with `AssertionError: Expected values to be strictly deep-equal:`

Run it with `node --test repro_removeone_negative.test.mjs` (fix the import path if you move it).

## Why this is a bug

removeOne explicitly accepts negative indices (range check i < -size, then i += size), and peekAt documents negative indices as counting from the end. The shifting branch is chosen with the un-normalised `index` (index < size/2), so a negative index always takes the front branch with a zero-iteration loop.

Independent review: removeOne explicitly accepts negative indices (`i < -size` is rejected, otherwise `i += size`), but the branch test `index < size / 2` and the loop counters still use the original `index`. With index -1, the front branch is taken with a zero-iteration loop. It then clears the slot of the last element and advances `_head`, so the queue ends up as [undefined] instead of [1]. The fix is to use the normalised `i` for the branch test and loop counts, which a maintainer would accept.

## How it was found

Property: *removeOne(i) behaves like Array.prototype.splice(i,1) on the equivalent array, including negative indices, leaving the remaining items intact*.

fast-check shrank the failure to: `Counterexample: [[],[["unshift",0],["splice",1,1,[0]]]]`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
