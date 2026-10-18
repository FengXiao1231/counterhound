# symmetric_difference_update leaves duplicate items when `other` contains repeated elements

| | |
|---|---|
| Function | `ordered_set.OrderedSet.symmetric_difference_update` in `ordered_set/__init__.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** OrderedSet().symmetric_difference_update([0, 0])

**Expected:** OrderedSet([0]), same as OrderedSet().symmetric_difference([0, 0])

**Actual:** items == [0, 0] while map has one key, so the set holds a duplicate and len is 2

## Reproduce

```python
from ordered_set import OrderedSet


def test_repro_symdiff_update_dups():
    s = OrderedSet()
    s.symmetric_difference_update([0, 0])
    assert list(s) == [0]
    assert list(OrderedSet().symmetric_difference([0, 0])) == [0]
```

Fails with `AssertionError: assert [0, 0] == [0]`

Save it as `test_repro_symdiff_update_dups.py` in your tests and run `pytest test_repro_symdiff_update_dups.py`.

## Why this is a bug

other is typed SetLike[T], which accepts lists; symmetric_difference handles it correctly and an OrderedSet must contain unique items. items_to_add is built without de-duplicating.

Independent review: `other` is typed `SetLike[T]`, which allows lists, and `symmetric_difference` already handles repeats correctly (`OrderedSet().symmetric_difference([0, 0])` gives `[0]`). In `symmetric_difference_update`, `items_to_add = [item for item in other if item not in self]` is not de-duplicated, so `_update_items` sets `items` to `[0, 0]` while `map` has one key. That breaks the OrderedSet uniqueness invariant, and builtin `set.symmetric_difference_update` also de-duplicates. A fix is small, for example by iterating over `dict.fromkeys(other)`, and a maintainer would likely accept it.

## How it was found

Property: *the set stays duplicate-free and matches symmetric_difference(other)*.

Hypothesis shrank the failure to: `Failing test case: test_symdiff_update( a=[], b=[0, 0], )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
