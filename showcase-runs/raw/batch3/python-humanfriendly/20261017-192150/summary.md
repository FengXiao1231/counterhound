<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 12 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> format_timespan(0, detailed=True) returns an empty string instead of '0 seconds' <sub>(wrong result, humanfriendly/__init__.py)</sub></summary>

| | |
|---|---|
| Function | `humanfriendly.format_timespan` |
| Input | format_timespan(0, detailed=True) |
| Expected | '0 seconds' (as format_timespan(0) gives) |
| Actual | '' (empty string), because all unit counts are zero and concatenate([]) is '' |
| Review | low severity, confidence 0.85 |

The input is valid, because coerce_seconds accepts 0 and the docstring says format_timespan(0) gives '0 seconds'. With detailed=True the slow path skips every zero-count unit, so `result` is empty and `concatenate([])` returns ''. The docstring says `detailed` only changes how milliseconds are shown, and no test or doc says an empty result is intended. The tests cover only non-zero values with detailed=True, so the empty string looks like an unhandled edge case, not a deliberate choice. A small fix is easy: return pluralize(0, 'second') when `result` is empty. Severity is low because it is a r

Failing test (`test_repro_timespan_zero_detailed.py`, failed 3/3 runs):

```python
from humanfriendly import format_timespan


def test_repro_timespan_zero_detailed():
    assert format_timespan(0) == '0 seconds'
    assert format_timespan(0, detailed=True) != ''
```

Suggested fix (the repro passes with it; project tests not compared (the suite already fails without the fix: python3 -m pytest -q -x -p no:cacheprovider --no-header)):

```diff
diff --git a/humanfriendly/__init__.py b/humanfriendly/__init__.py
index 4c0a333..90f9aee 100644
--- a/humanfriendly/__init__.py
+++ b/humanfriendly/__init__.py
@@ -452,7 +452,10 @@ def format_timespan(num_seconds, detailed=False, max_units=3):
             # Only include relevant units in the result.
             if count not in (0, '0'):
                 result.append(pluralize(count, unit['singular'], unit['plural']))
-        if len(result) == 1:
+        if not result:
+            # All unit counts are zero (or rounded to zero).
+            return pluralize(0, 'second')
+        elif len(result) == 1:
             # A single count/unit combination.
             return result[0]
         else:
```
</details>

<sub>1m10s · $0.41 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
