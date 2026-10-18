# Integer 0 expands as empty in {?x} and {;x}

| | |
|---|---|
| Function | `uritemplate.api.expand` in `uritemplate/api.py` |
| Kind | Wrong result |
| Review | unclear, confidence 0.00, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** expand('{?a}', {'a': 0})

**Expected:** '?a=0' (and ';a=0' for '{;a}')

**Actual:** '?a=' (and ';a')

## Reproduce

```python
from uritemplate.api import expand


def test_repro_zero_query():
    assert expand("{?a}", {"a": 0}) == "?a=0"
    assert expand("{;a}", {"a": 0}) == ";a=0"
```

Fails with `AssertionError: assert '?a=' == '?a=0'`

Save it as `test_repro_zero_query.py` in your tests and run `pytest test_repro_zero_query.py`.

## Why this is a bug

ScalarVariableValue includes int; RFC 6570 expands the string form of the value, '0' is non-empty. Code uses truthiness (`if value:`) in _query_expansion/_semi_path_expansion, so 0 is treated as empty; other operators give '0'.

Independent review: reviewer gave no reason

## How it was found

Property: *expanding {?a} with a=0 yields ?a=0*.

Hypothesis shrank the failure to: `Failing test case: test_int_query( n='a', # or any other generated value v=0, )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
