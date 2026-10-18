# relative_time() drops requested decimal digits because it formats with :g (6 significant digits)

| | |
|---|---|
| Function | `boltons.timeutils.relative_time` in `boltons/timeutils.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** d=datetime(2000,1,1), other=d+timedelta(seconds=1, microseconds=123456), ndigits=6

**Expected:** '1.123456 seconds ago'

**Actual:** '1.12346 seconds ago'

## Reproduce

```python
from datetime import datetime, timedelta
from boltons.timeutils import relative_time


def test_repro_relative_time_ndigits():
    d = datetime(2000, 1, 1)
    other = d + timedelta(seconds=1, microseconds=123456)
    assert relative_time(d, other, ndigits=6) == '1.123456 seconds ago'
```

Fails with `AssertionError: assert '1.12346 seconds ago' == '1.123456 seconds ago'`

## Why this is a bug

Docstring: ndigits is 'The number of decimal digits to round to'. decimal_relative_time returns 1.123456, but relative_time formats with f'{abs(drt):g}', which keeps only 6 significant digits, so the requested precision is silently lost.

Independent review: The docstring says ndigits is the number of decimal digits to round to, and decimal_relative_time rounds correctly to 1.123456. relative_time then formats with f'{abs(drt):g}', which keeps only 6 significant digits, so the printed value is 1.12346. The same happens whenever the integer part plus ndigits exceeds 6 digits, for example 12.123456 with ndigits=6 prints 12.1235. The :g format is there to drop trailing zeros ('0 seconds ago'), and a fix could keep that. The impact is narrow, since ndigits above 5 is rare, and no existing test covers it.

## How it was found

Property: *the number printed by relative_time equals the value returned by decimal_relative_time rounded to ndigits*.

Hypothesis shrank the failure to: `Failing test case: test_relative_time_ndigits( d=datetime.datetime(2000, 1, 1, 0, 0), # or any other generated value secs=1, nd=6, )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
