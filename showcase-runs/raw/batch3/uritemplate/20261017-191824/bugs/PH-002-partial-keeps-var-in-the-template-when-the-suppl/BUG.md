# partial() keeps {var} in the template when the supplied value expands to an empty string

| | |
|---|---|
| Function | `uritemplate.api.partial` in `uritemplate/api.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** partial('a{x}b', {'x': ''})

**Expected:** URITemplate('ab'), same as expand

**Actual:** URITemplate('a{x}b')

## Reproduce

```python
from uritemplate.api import expand, partial


def test_repro_partial_empty():
    assert str(partial("a{x}b", {"x": ""})) == expand("a{x}b", {"x": ""}) == "ab"
```

Fails with `AssertionError: assert 'a{x}b' == 'ab'`

Save it as `test_repro_partial_empty.py` in your tests and run `pytest test_repro_partial_empty.py`.

## Why this is a bug

partial docs: only missing params stay in the template; x was given. template._expand uses `expanded.get(...) or var`, conflating empty expansion with absent.

Independent review: URITemplate._expand uses `expanded.get(match_group) or var` in replace_partial. That treats an empty expansion, which is what a supplied '' produces for `{x}`, the same as a variable that was never supplied. So `partial('a{x}b', {'x': ''})` returns `a{x}b` while `expand` returns `ab`. The docstring says only missing parameters should remain, and the fix is small: test whether the key is absent or the variable was supplied, instead of testing truthiness. The case is an edge one, but a maintainer would probably accept the fix.

## How it was found

Property: *partial with all variables supplied equals expand*.

Hypothesis shrank the failure to: `Failing test case: test_partial_full_equals_expand( n='a', # or any other generated value v='', )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
