# format_timespan(0, detailed=True) returns an empty string instead of '0 seconds'

| | |
|---|---|
| Function | `humanfriendly.format_timespan` in `humanfriendly/__init__.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** format_timespan(0, detailed=True)

**Expected:** '0 seconds' (as format_timespan(0) gives)

**Actual:** '' (empty string), because all unit counts are zero and concatenate([]) is ''

## Reproduce

```python
from humanfriendly import format_timespan


def test_repro_timespan_zero_detailed():
    assert format_timespan(0) == '0 seconds'
    assert format_timespan(0, detailed=True) != ''
```

Fails with `AssertionError: assert '' != ''`

Save it as `test_repro_timespan_zero_detailed.py` in your tests and run `pytest test_repro_timespan_zero_detailed.py`.

## Suggested fix

The repro passes with this patch; the project's tests not compared (the suite already fails without the fix: python3 -m pytest -q -x -p no:cacheprovider --no-header). Apply it with `git apply fix.patch`.

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

## Why this is a bug

Docstring: format_timespan(0) -> '0 seconds'; returns 'The formatted timespan as a string'. detailed only changes how milliseconds are represented, so zero should still render as a quantity.

Independent review: The input is valid, because coerce_seconds accepts 0 and the docstring says format_timespan(0) gives '0 seconds'. With detailed=True the slow path skips every zero-count unit, so `result` is empty and `concatenate([])` returns ''. The docstring says `detailed` only changes how milliseconds are shown, and no test or doc says an empty result is intended. The tests cover only non-zero values with detailed=True, so the empty string looks like an unhandled edge case, not a deliberate choice. A small fix is easy: return pluralize(0, 'second') when `result` is empty. Severity is low because it is a rare edge case.

## How it was found

Property: *formatting a valid zero timespan yields a non-empty human readable string (and parse_timespan of its parts gives back 0)*.

Hypothesis shrank the failure to: `Failing test case: test_timespan_float_detailed( x=0.0, )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
