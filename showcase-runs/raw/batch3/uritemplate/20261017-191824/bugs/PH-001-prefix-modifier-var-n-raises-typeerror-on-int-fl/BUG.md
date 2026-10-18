# Prefix modifier (`{var:N}`) raises TypeError on int/float scalar values

| | |
|---|---|
| Function | `uritemplate.api.expand` in `uritemplate/variable.py:450` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.88, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** expand('{a:1}', {'a': 12})

**Expected:** '1'

**Actual:** `TypeError: 'int' object is not subscriptable`

## Reproduce

```python
from uritemplate.api import expand


def test_repro_int_prefix():
    assert expand("{a:1}", {"a": 12}) == "1"
```

Fails with `TypeError: 'int' object is not subscriptable`

Save it as `test_repro_int_prefix.py` in your tests and run `pytest test_repro_int_prefix.py`.

## Why this is a bug

VariableValue type allows int; RFC 6570 prefix applies to the string form; value[:prefix] is applied without str() conversion in variable.py.

Independent review: `ScalarVariableValue` explicitly includes int, float and complex, and `Operator.quote` already converts non-strings with `str()` (variable.py:159). So `{a}` with `a=12` works, but `{a:1}` slices the raw int at variable.py:450 (the same pattern appears at lines 315, 368 and 417) and raises `TypeError: 'int' object is not subscriptable`. RFC 6570 applies the prefix to the string form, so the expected result `'1'` is correct. The existing tests only use string values, so nothing documents the crash as intended, and a maintainer would likely accept a small `str(value)[:prefix]` fix.

## How it was found

Property: *{a:N} on an int value truncates its string form without raising*.

Hypothesis shrank the failure to: `Failing test case: test_int_prefix( # The test always failed when commented parts were varied together. n='a', # or any other generated value v=10, # or any other generated value p=1, # or any other generated value )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
