# Stats([]).format_histogram() raises ZeroDivisionError when all bin counts are zero

| | |
|---|---|
| Function | `boltons.statsutils.format_histogram_counts` in `boltons/statsutils.py:835` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Stats([]).format_histogram()

**Expected:** a string (or a clear documented error)

**Actual:** `ZeroDivisionError: float division by zero`

## Reproduce

```python
from boltons.statsutils import Stats


def test_repro_empty_hist():
    # empty Stats are supported elsewhere (default value); must not raise ZeroDivisionError
    out = Stats([]).format_histogram()
    assert isinstance(out, str)
```

Fails with `ZeroDivisionError: float division by zero`

## Why this is a bug

Stats has a `default` for empty data and get_quantile/describe handle empty data; get_histogram_counts explicitly handles empty data by returning [(0.0, 0)] (_get_bin_bounds returns [0.0]), but format_histogram_counts divides by the max count, which is 0.

Independent review: Stats supports empty data, and get_histogram_counts deliberately returns [(0.0, 0)] for it (_get_bin_bounds returns [0.0]). format_histogram_counts then computes `float(bar_cols) / count_max` with count_max == 0 and crashes. Nothing documents or tests this as an intended error, and the guard is trivial (for example, treating a zero count_max as 1), so a maintainer would likely accept the fix. The impact is a narrow edge case, hence low severity.

## How it was found

Property: *format_histogram does not crash on an empty dataset, which Stats supports (default value)*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
