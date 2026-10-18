<!-- proofhound-report -->
### proofhound found 2 provable bugs

Checked 6 functions in 1 modules with property-based tests. 2 reported → 2 reproduced → 2 unique → 2 confirmed by an independent review.

<details><summary><b>PH-001</b> OrderedSet.pop(index) does not renumber map, so index() returns stale positions after popping a non-last element <sub>(wrong result, ordered_set/__init__.py)</sub></summary>

| | |
|---|---|
| Function | `ordered_set.OrderedSet.pop` |
| Input | s = OrderedSet([0, 1]); s.pop(0); s.index(1) |
| Expected | 0, since the set is now OrderedSet([1]) |
| Actual | 1 (map still holds the old position) |
| Review | medium severity, confidence 0.93 |

The source shows pop() does `del self.items[index]; del self.map[elem]` and never decrements the map values for the items after the removed one. discard() does that renumbering (`if v >= i: self.map[k] = v - 1`), so the two removal paths leave the set in different states. The invariant `map[items[i]] == i` is broken, so index(), get_loc() and later add() calls give wrong results. For example, after pop(0) on OrderedSet([0, 1]), index(1) returns 1 while the set is [1]. The repro uses documented API (`pop(index)` is documented to remove the item at index) and failed every time. A maintainer woul

Failing test (`test_repro_pop_stale_index.py`, failed 3/3 runs):

```python
from ordered_set import OrderedSet


def test_repro_pop_stale_index():
    s = OrderedSet([0, 1])
    assert s.pop(0) == 0
    assert list(s) == [1]
    assert s.index(1) == 0
```
</details>

<details><summary><b>PH-002</b> symmetric_difference_update leaves duplicate items when `other` contains repeated elements <sub>(wrong result, ordered_set/__init__.py)</sub></summary>

| | |
|---|---|
| Function | `ordered_set.OrderedSet.symmetric_difference_update` |
| Input | OrderedSet().symmetric_difference_update([0, 0]) |
| Expected | OrderedSet([0]), same as OrderedSet().symmetric_difference([0, 0]) |
| Actual | items == [0, 0] while map has one key, so the set holds a duplicate and len is 2 |
| Review | low severity, confidence 0.93 |

`other` is typed `SetLike[T]`, which allows lists, and `symmetric_difference` already handles repeats correctly (`OrderedSet().symmetric_difference([0, 0])` gives `[0]`). In `symmetric_difference_update`, `items_to_add = [item for item in other if item not in self]` is not de-duplicated, so `_update_items` sets `items` to `[0, 0]` while `map` has one key. That breaks the OrderedSet uniqueness invariant, and builtin `set.symmetric_difference_update` also de-duplicates. A fix is small, for example by iterating over `dict.fromkeys(other)`, and a maintainer would likely accept it.

Failing test (`test_repro_symdiff_update_dups.py`, failed 3/3 runs):

```python
from ordered_set import OrderedSet


def test_repro_symdiff_update_dups():
    s = OrderedSet()
    s.symmetric_difference_update([0, 0])
    assert list(s) == [0]
    assert list(OrderedSet().symmetric_difference([0, 0])) == [0]
```
</details>

<sub>58s · $0.28 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
