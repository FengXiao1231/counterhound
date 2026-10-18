# remove_transition does not convert State/Enum elements in a source/dest list to names

| | |
|---|---|
| Function | `transitions.core.Machine.remove_transition` in `transitions/core.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Machine(states=['A','B','C'], auto_transitions=False); add_transition('go','A','B'); add_transition('go','B','C'); remove_transition('go', source=[m.get_state('A')])

**Expected:** only the B->C transition remains

**Actual:** nothing is removed; both transitions remain

## Reproduce

```python
from transitions import Machine


def test_repro_remove_transition_list_of_state_objects():
    m = Machine(states=['A', 'B', 'C'], initial='A', auto_transitions=False)
    m.add_transition('go', 'A', 'B')
    m.add_transition('go', 'B', 'C')
    m.remove_transition('go', source=[m.get_state('A')])
    assert [(t.source, t.dest) for t in m.get_transitions('go')] == [('B', 'C')]
```

Fails with `AssertionError: assert [('A', 'B'), ('B', 'C')] == [('B', 'C')]`

Save it as `test_repro_remove_list_of_states.py` in your tests and run `pytest test_repro_remove_list_of_states.py`.

## Why this is a bug

Docstring: source/dest are 'str, Enum or State'; the code listify()s the argument and converts each element, but the comprehension tests hasattr(source, 'name') (the whole list/original arg) instead of hasattr(s, 'name'), so list elements that are State/Enum are never converted to names and never match t.source/t.dest (stored as names). The same State passed alone (not in a list) works.

Independent review: In core.py:1141 and 1143 the comprehensions test `hasattr(source, 'name')` and `hasattr(dest, 'name')` on the whole argument instead of the loop variable `s`/`d`. After `listify`, a list of State or Enum objects therefore keeps its elements unconverted and never matches `t.source`/`t.dest`, which are stored as names. A single State passed alone works because `listify` wraps it and the whole-argument check happens to see `.name`. The repro is valid and fails deterministically, and the fix is a one-token change that a maintainer would accept. The only doubt is that the docstring says `str, Enum or State` and doesn't explicitly mention lists, but the code runs `listify` and a list of names works, so lists are clearly intended.

## How it was found

Property: *removing with source=[State] (or dest=[State]) removes exactly the same transitions as passing the state name strings*.

Hypothesis shrank the failure to: `Failing test case: test_remove_by_source_list( trs=[( 'A', 'A', # or any other generated value )], srcs=['A'], use_state=True, )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
