# TracebackInfo.from_dict leaves frames as plain dicts instead of rebuilding Callpoint objects

| | |
|---|---|
| Function | `boltons.tbutils.TracebackInfo.from_dict` in `boltons/tbutils.py:323` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** ti = TracebackInfo.from_traceback() for a caught ValueError; d = ti.to_dict()

**Expected:** from_dict(d) yields a TracebackInfo whose frames are Callpoints, so to_dict() and str() work and to_dict() equals d

**Actual:** `AttributeError: 'dict' object has no attribute 'to_dict'`

## Reproduce

```python
from boltons.tbutils import TracebackInfo


def test_repro_from_dict():
    def f():
        raise ValueError('x')
    try:
        f()
    except ValueError:
        ti = TracebackInfo.from_traceback()
    d = ti.to_dict()
    ti2 = TracebackInfo.from_dict(d)
    assert ti2.to_dict() == d
    str(ti2)
```

Fails with `AttributeError: 'dict' object has no attribute 'to_dict'`

## Why this is a bug

Docstring: 'Complements TracebackInfo.to_dict'. The source is `return cls(d['frames'])` with a '# TODO: check this.' comment.

Independent review: The docstring says from_dict 'Complements' to_dict, which implies a round trip. But `cls(d['frames'])` keeps the frames as raw dicts, so `to_dict()` and `str()` on the result fail with AttributeError. The author's own `# TODO: check this.` suggests the method was never finished, nothing else in the repo uses it, and no test covers it. The input is exactly what to_dict produces, and the repro is correct. The fix is small: build Callpoint objects from each frame dict.

## How it was found

Property: *TracebackInfo.from_dict(ti.to_dict()).to_dict() == ti.to_dict()*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
