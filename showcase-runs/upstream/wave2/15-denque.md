TITLE: removeOne and remove corrupt the queue when given a negative index
REPO: invertase/denque
SEARCH: removeOne negative index
BODY:
`removeOne(index)` and `remove(index, count)` accept a negative index (both normalise it with `if (i < 0) i += size`, and `peekAt(-1)` is the documented way to address the last item), but the branch that decides which side to shift from, and the shift loops, still use the raw `index`:

```js
const Denque = require('denque');

let d = new Denque([1, 2]);
d.removeOne(-1);   // returns 2, as documented
d.toArray();       // [ undefined ]            expected [1]

d = new Denque([1, 2, 3, 4]);
d.remove(-3, 2);   // returns [2, 3], as documented
d.toArray();       // [ undefined, 1, 2, 3, 4 ]   expected [1, 4]
```

In `removeOne`, `if (index < size / 2)` is true for every negative index, so the head-side branch runs with `k = index` (negative, loop skipped) and then clears the slot and advances `_head`: the first element is dropped instead of the chosen one. `remove` has the same pattern (`if (index + count === size)`, `if (index === 0)`, and the loops) after normalising `i`.

Reproduced on 2.1.0 (master 539105b). Using the normalised value in those tests and loops fixes it. Happy to send a PR with tests if you would take one.
