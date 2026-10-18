# memoize of a unary function raises IndexError when its sole argument is passed by keyword

| | |
|---|---|
| Function | `toolz.functoolz.memoize` in `toolz/functoolz.py:444` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** def f(a): return a + 1; memoize(f)(a=0)

**Expected:** 1, same as f(a=0)

**Actual:** `IndexError: tuple index out of range`

## Reproduce

```python
from toolz.functoolz import memoize


def test_repro_memoize_unary_kwarg():
    def f(a):
        return a + 1

    assert f(a=0) == 1
    assert memoize(f)(a=0) == 1
```

Fails with `IndexError: tuple index out of range`

## Why this is a bug

memoize wraps arbitrary functions (docstring: 'Cache a function's result'), and its docs discuss kwargs handling; f(a=0) is valid for the original. The default key for unary functions unconditionally uses args[0], ignoring that the sole parameter may be passed by keyword.

Independent review: The default key for unary functions is `args[0]`. `memoize` applies it to any function where `is_arity(1, func)` is true, such as `def f(a)`, which can legally be called as `f(a=0)`. In that case `args` is empty and the wrapper raises IndexError, while the original function works. The existing tests only cover unary functions called positionally, and nothing documents that keyword calls are unsupported. A fix is cheap: fall back to the generic key when `args` is empty.

## How it was found

Property: *a memoized function can be called in every way the original can, and returns the same result*.

Hypothesis shrank the failure to: `Failing test case: test_memoize_unary_kwarg( x=0, # or any other generated value )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
