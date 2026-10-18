<!-- proofhound-report -->
### proofhound found 1 provable bug (1 with a verified fix)

Checked 6 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> parse_time raises ValueError for hour fractions with many trailing 9s (microsecond rounds up to 1000000) <sub>(crash, src/isodate/isotime.py:134)</sub></summary>

| | |
|---|---|
| Function | `isodate.isotime.parse_time` |
| Input | parse_time('00.9999999999999') (also '10.99999999999999') |
| Expected | A datetime.time just before the next hour (e.g. 00:59:59.999999), as the seconds/minutes branches do via ROUND_FLOOR |
| Actual | ValueError: microsecond must be in 0..999999 |
| Review | low severity, confidence 0.90 |

'10.99999999999999' matches the documented 'hh.hh' format, where the regex allows any number of fraction digits. In the hour-only branch (isotime.py:129-140), the seconds are never floored to 6 places like the second and minute branches do with ROUND_FLOOR. Instead, `microsecond.to_integral()` rounds up to 1000000, and `time()` raises a raw ValueError rather than returning 10:59:59.999999 or an ISO8601Error. A maintainer would accept a small fix that quantizes with ROUND_FLOOR, matching the sibling branches. The inputs are unusual, so impact is low.

Failing test (`test_repro_hour_fraction_rounding.py`, failed 3/3 runs):

```python
from isodate.isotime import parse_time


def test_repro_hour_fraction_rounding():
    # 10.99999999999999 hours is just under 11:00:00; must not raise
    t = parse_time("10.99999999999999")
    assert t.hour in (10, 11)
```

Suggested fix (the repro passes with it; project tests passed (python3 -m pytest -q -x -p no:cacheprovider --no-header)):

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
</details>

<sub>1m14s · $0.37 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
