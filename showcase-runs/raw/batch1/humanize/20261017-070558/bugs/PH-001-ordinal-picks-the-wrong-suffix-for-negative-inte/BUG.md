# ordinal() picks the wrong suffix for negative integers (-1 -> '-1th')

| | |
|---|---|
| Function | `humanize.number.ordinal` in `src/humanize/number.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.72, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** ordinal(-1)

**Expected:** '-1st' (also -2 -> '-2nd', -3 -> '-3rd', -21 -> '-21st')

**Actual:** '-1th', '-2th', '-3th', '-21th'

## Reproduce

```python
import sys, types
if "humanize._version" not in sys.modules:
    _m = types.ModuleType("humanize._version")
    _m.__version__ = "0"
    sys.modules["humanize._version"] = _m
from humanize.number import ordinal


def test_repro_ordinal_negative():
    assert ordinal(-1) == "-1st"
    assert ordinal(-2) == "-2nd"
    assert ordinal(-3) == "-3rd"
    assert ordinal(-21) == "-21st"
```

Fails with `AssertionError: assert '-1th' == '-1st'`

## Why this is a bug

Docstring: 'Works for any integer'; 1 is '1st', 2 is '2nd', 3 is '3rd'. The code uses Python's modulo (value % 10, value % 100) on a negative value, which yields 9/8/7 etc., so the suffix is chosen from the wrong digit.

Independent review: The docstring says ordinal() "works for any integer", and negative ints are valid input. The code takes `value % 10` and `value % 100` on the signed value. Python's modulo is non-negative, so -1 gives digit 9 and the suffix 'th', while the suffix for -n should depend on the digits of n. The repro is correct and fails deterministically. The only doubt is that negative ordinals are unusual and untested, and no test or doc promises '-1st'. Even so, '-1th' is clearly wrong, and the fix is a one-line `abs(value)` in the modulo expressions, so a maintainer would likely accept it.

## How it was found

Property: *the ordinal suffix of -n depends on the digits of n, same as for n (1->st, 2->nd, 3->rd, 11-13->th)*.

Hypothesis shrank the failure to: `Failing test case: test_ordinal_matches_reference( n=-1, )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
