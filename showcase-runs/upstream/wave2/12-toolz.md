TITLE: memoize of a unary function raises IndexError when the argument is passed by keyword
REPO: pytoolz/toolz
SEARCH: memoize keyword IndexError
BODY:
```python
>>> from toolz import memoize
>>> def f(a):
...     return a + 1
>>> f(a=0)
1
>>> memoize(f)(a=0)
IndexError: tuple index out of range
```

In `toolz/functoolz.py`, `memoize` picks the key function by arity: for a unary function the key is `args[0]`, which assumes the argument always arrives positionally. `f(a=0)` is a valid call of `f`, so the memoized function should accept it too (either by using `(args, frozenset(kwargs.items()))` as the key when `kwargs` is non-empty, or by normalising the keyword to positional for the unary case).

Reproduced on main 451af60. Happy to send a PR with a test if you would take one.
