TITLE: pop(index) does not renumber the position map, so index() is wrong afterwards
REPO: rspeer/ordered-set
SEARCH: pop index map renumber
BODY:
```python
>>> from ordered_set import OrderedSet
>>> s = OrderedSet([0, 1])
>>> s.pop(0)
0
>>> list(s)
[1]
>>> s.index(1)
1            # expected 0
>>> s[s.index(1)]
IndexError: list index out of range
```

`pop` does `del self.items[index]; del self.map[elem]` and stops there, while `discard` (right below it) also renumbers every later entry of `self.map`. After popping anything but the last element, `index()` and everything built on it (`__getitem__` through `index`, `__contains__` stays fine) refer to the old positions.

A second, smaller one in the same file: `symmetric_difference_update` builds `items_to_add` from `other` without de-duplicating, so the set can end up holding the same element twice:

```python
>>> s = OrderedSet()
>>> s.symmetric_difference_update([0, 0])
>>> list(s), len(s)
([0, 0], 2)       # expected ([0], 1); symmetric_difference([0, 0]) gives [0]
```

Both reproduced on master 9dfc91c. For `pop`, delegating to `discard(elem)` (or sharing its renumbering loop) fixes it; for the second, de-duplicate `items_to_add` while keeping order. Happy to send a PR with tests if you would take one.
