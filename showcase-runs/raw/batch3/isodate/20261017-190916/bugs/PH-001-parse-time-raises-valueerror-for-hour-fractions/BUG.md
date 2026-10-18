# parse_time raises ValueError for hour fractions with many trailing 9s (microsecond rounds up to 1000000)

| | |
|---|---|
| Function | `isodate.isotime.parse_time` in `src/isodate/isotime.py:134` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.90, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** parse_time('00.9999999999999') (also '10.99999999999999')

**Expected:** A datetime.time just before the next hour (e.g. 00:59:59.999999), as the seconds/minutes branches do via ROUND_FLOOR

**Actual:** `ValueError: microsecond must be in 0..999999`

## Reproduce

```python
from isodate.isotime import parse_time


def test_repro_hour_fraction_rounding():
    # 10.99999999999999 hours is just under 11:00:00; must not raise
    t = parse_time("10.99999999999999")
    assert t.hour in (10, 11)
```

Fails with `ValueError: microsecond must be in 0..999999`

Save it as `test_repro_hour_fraction_rounding.py` in your tests and run `pytest test_repro_hour_fraction_rounding.py`.

## Suggested fix

The repro passes with this patch; the project's tests passed (python3 -m pytest -q -x -p no:cacheprovider --no-header). Apply it with `git apply fix.patch`.

```diff
diff --git a/src/isodate/isotime.py b/src/isodate/isotime.py
index 78b4de2..18c72b0 100644
--- a/src/isodate/isotime.py
+++ b/src/isodate/isotime.py
@@ -129,7 +129,9 @@ def parse_time(timestring: str) -> time:
                 microsecond, second, minute = Decimal(0), Decimal(0), Decimal(0)
             hour = Decimal(groups["hour"])
             minute = (hour - int(hour)) * 60
-            second = Decimal((minute - int(minute)) * 60)
+            second = Decimal((minute - int(minute)) * 60).quantize(
+                Decimal(".000001"), rounding=ROUND_FLOOR
+            )
             microsecond = (second - int(second)) * int(1e6)
             return time(
                 int(hour),
```

## Why this is a bug

Docstring lists 'hh.hhTZD' with arbitrary decimal fraction as supported; the regex accepts any number of digits. The hour-fraction branch skips the ROUND_FLOOR quantize used by the minute/second branches and then calls to_integral() (rounding), so microsecond can become 1000000.

Independent review: '10.99999999999999' matches the documented 'hh.hh' format, where the regex allows any number of fraction digits. In the hour-only branch (isotime.py:129-140), the seconds are never floored to 6 places like the second and minute branches do with ROUND_FLOOR. Instead, `microsecond.to_integral()` rounds up to 1000000, and `time()` raises a raw ValueError rather than returning 10:59:59.999999 or an ISO8601Error. A maintainer would accept a small fix that quantizes with ROUND_FLOOR, matching the sibling branches. The inputs are unusual, so impact is low.

## How it was found

Property: *any syntactically valid 'hh.hhh...' time string parses to a time or raises ISO8601Error, never a raw ValueError from time()*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
