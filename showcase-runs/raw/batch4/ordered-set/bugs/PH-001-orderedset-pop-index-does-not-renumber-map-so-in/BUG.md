# OrderedSet.pop(index) does not renumber map, so index() returns stale positions after popping a non-last element

| | |
|---|---|
| Function | `ordered_set.OrderedSet.pop` in `ordered_set/__init__.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** s = OrderedSet([0, 1]); s.pop(0); s.index(1)

**Expected:** 0, since the set is now OrderedSet([1])

**Actual:** 1 (map still holds the old position)

## Reproduce

```python
from ordered_set import OrderedSet


def test_repro_pop_stale_index():
    s = OrderedSet([0, 1])
    assert s.pop(0) == 0
    assert list(s) == [1]
    assert s.index(1) == 0
```

Fails with `AssertionError: assert 1 == 0`

Save it as `test_repro_pop_stale_index.py` in your tests and run `pytest test_repro_pop_stale_index.py`.

## Why this is a bug

index() docstring: 'Get the index of a given entry'; add() returns the item's index. discard() renumbers map after removal, but pop() only deletes the entry and never adjusts later indices. Popping a non-last element is allowed by the documented 'Remove and return item at index'.

Independent review: The source shows pop() does `del self.items[index]; del self.map[elem]` and never decrements the map values for the items after the removed one. discard() does that renumbering (`if v >= i: self.map[k] = v - 1`), so the two removal paths leave the set in different states. The invariant `map[items[i]] == i` is broken, so index(), get_loc() and later add() calls give wrong results. For example, after pop(0) on OrderedSet([0, 1]), index(1) returns 1 while the set is [1]. The repro uses documented API (`pop(index)` is documented to remove the item at index) and failed every time. A maintainer would accept a fix that renumbers the map after popping a non-last index, as discard() does.

## How it was found

Property: *after pop(i), index(x) equals the position of x in the set's iteration order*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
