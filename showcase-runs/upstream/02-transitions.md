TITLE: remove_transition does nothing when source or dest is a list of State objects
REPO: pytransitions/transitions
SEARCH: remove_transition
BODY:
`Machine.remove_transition` accepts `State` objects for `source`/`dest` (`transitions/core.py`, around line 1141):

```python
source = [s.name if hasattr(source, 'name') else s for s in listify(source)]
dest = [d.name if hasattr(dest, 'name') else d for d in listify(dest)]
```

The condition tests `source`/`dest` (the whole argument) instead of the loop variable `s`/`d`. With a single `State` it works, because `source` itself has `.name`. With a list of `State` objects the list has no `.name`, so the `State` objects are kept as they are, no name matches, and nothing is removed, silently.

### Repro (current master, bd42b38)

```python
from transitions import Machine

m = Machine(states=['A', 'B'], transitions=[{'trigger': 'go', 'source': 'A', 'dest': 'B'}], initial='A')

m.remove_transition('go', source=[m.get_state('A')])
print(m.get_transitions('go'))   # [<Transition('A', 'B')>]  (expected [])

m.remove_transition('go', source=m.get_state('A'))
print(m.get_transitions('go'))   # []
```

### Fix

```python
source = [s.name if hasattr(s, 'name') else s for s in listify(source)]
dest = [d.name if hasattr(d, 'name') else d for d in listify(dest)]
```

Found by a model-based property test (after `remove_transition(t, source=S)`, `get_transitions(t, source=S)` is empty). I can send a PR with the two-character fix and a test if that is easier.
