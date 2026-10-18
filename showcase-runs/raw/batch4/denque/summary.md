<!-- counterhound-report -->
### counterhound found 2 provable bugs

Checked 1 functions in 1 modules with property-based tests. 2 reported → 2 reproduced → 2 unique → 2 confirmed by an independent review.

<details><summary><b>PH-001</b> removeOne() with a negative index corrupts the queue because the branch choice uses the un-normalised index <sub>(wrong result, index.js)</sub></summary>

| | |
|---|---|
| Function | `Denque.prototype.removeOne` |
| Input | new Denque([1,2]).removeOne(-1) |
| Expected | returns 2 and the queue becomes [1] |
| Actual | returns 2 but the queue becomes [undefined, 1]-like corrupted state (the front slot is cleared and head advanced instead of removing the last item) |
| Review | medium severity, confidence 0.93 |

removeOne explicitly accepts negative indices (`i < -size` is rejected, otherwise `i += size`), but the branch test `index < size / 2` and the loop counters still use the original `index`. With index -1, the front branch is taken with a zero-iteration loop. It then clears the slot of the last element and advances `_head`, so the queue ends up as [undefined] instead of [1]. The fix is to use the normalised `i` for the branch test and loop counts, which a maintainer would accept.

Failing test (`repro_removeone_negative.test.mjs`, failed 3/3 runs):

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
</details>

<details><summary><b>PH-002</b> remove() with a negative index and count > 1 corrupts the queue <sub>(wrong result, index.js)</sub></summary>

| | |
|---|---|
| Function | `Denque.prototype.remove` |
| Input | new Denque([1,2,3,4]).remove(-3, 2) |
| Expected | returns [2,3] and the queue becomes [1,4] |
| Actual | queue is left with undefined holes and wrong contents |
| Review | medium severity, confidence 0.90 |

remove() explicitly accepts negative indices (`i < -size` check, then `i += size`). After that, the multi-item branches still test and use the raw `index` (`index + count === size`, `index === 0`, `this._head + index + count`, `index < 0`) instead of the normalised `i`. For `remove(-3, 2)` on [1,2,3,4], none of the fast paths match and the middle-removal branch uses a negative `index`. That leaves `undefined` holes and wrong contents, as the repro shows. The `count === 1` path uses the normalised `i` and works, and positive indices are unaffected, so this is an incomplete normalisation that a 

Failing test (`repro_remove_negative.test.mjs`, failed 3/3 runs):

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
</details>

<sub>1m04s · $0.31 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
