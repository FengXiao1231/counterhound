# camelize('', uppercase_first_letter=False) raises IndexError on empty string

| | |
|---|---|
| Function | `inflection.camelize` in `inflection/__init__.py:171` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** camelize('', False)

**Expected:** ''

**Actual:** `IndexError: string index out of range`

## Reproduce

```python
from inflection import camelize


def test_repro_camelize_empty():
    assert camelize("", True) == ""
    assert camelize("", False) == ""
```

Fails with `IndexError: string index out of range`

## Why this is a bug

Signature is camelize(string: str, ...) with no documented restriction on empty strings; camelize('') returns '' for the default flag, so the False branch is inconsistent.

Independent review: The signature accepts any `str` and the docstring excludes no inputs. `camelize('')` correctly returns `''`, but the `False` branch evaluates `string[0]` unguarded (inflection/__init__.py:171) and raises IndexError. Empty strings are a normal edge case, the two branches should agree, and the fix is trivial, e.g. `string[:1].lower() + camelize(string)[1:]`.

## How it was found

Property: *camelize does not crash on any str; the empty string maps to the empty string for both values of uppercase_first_letter*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
