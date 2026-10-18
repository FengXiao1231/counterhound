# Integer 0 expands as empty value in ? / & / ; expansions

| | |
|---|---|
| Function | `uritemplate.variable.URIVariable.expand` in `uritemplate/variable.py` |
| Kind | Wrong result |
| Review | unclear, confidence 0.00, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** URIVariable('?x').expand({'x': 0}); URIVariable(';x').expand({'x': 0})

**Expected:** '?x=0' and ';x=0'

**Actual:** '?x=' and ';x' (0 is treated as empty string by a truthiness check `if value:`)

## Reproduce

```python
from uritemplate.variable import URIVariable


def test_repro_zero():
    assert URIVariable("?x").expand({"x": 0})["?x"] == "?x=0"
    assert URIVariable(";x").expand({"x": 0})[";x"] == ";x=0"
```

Fails with `AssertionError: assert '?x=' == '?x=0'`

Save it as `test_repro_zero.py` in your tests and run `pytest test_repro_zero.py`.

## Why this is a bug

ScalarVariableValue includes int; RFC 6570 only treats the empty string as empty (3.2.7/3.2.8), 0 is defined and stringifies to '0'; other ints like 1 expand correctly.

Independent review: reviewer gave no reason

## How it was found

Property: *a scalar int n expands to its decimal string in query and path-parameter expansion*.

Hypothesis shrank the failure to: `Failing test case: test_query_int_zero_and_ints( n=0, )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
