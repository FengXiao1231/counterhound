# normalize_uri drops an empty-but-present authority (file:///path becomes file:/path)

| | |
|---|---|
| Function | `rfc3986.api.normalize_uri` in `src/rfc3986/api.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.62, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** file:///etc/hosts

**Expected:** file:///etc/hosts

**Actual:** file:/etc/hosts

## Reproduce

```python
from rfc3986.api import normalize_uri


def test_repro_empty_authority_dropped():
    # "file:///etc/hosts" has an empty (but present) authority; normalizing
    # must not change the URI's structure.
    assert normalize_uri("file:///etc/hosts") == "file:///etc/hosts"
```

Fails with `AssertionError: assert 'file:/etc/hosts' == 'file:///etc/hosts'`

## Why this is a bug

RFC 3986 section 5.3 recomposition: if authority is defined (even empty), append '//' + authority. Docstring says normalize_uri equals uri_reference(uri).normalize().unsplit(); normalization (6.2.2) must not change the URI's meaning. unsplit() uses truthiness of authority, so '//' is lost (also '//' -> '').

Independent review: normalize() rebuilds the authority with normalize_authority(), which returns '' for an empty authority. unsplit() then tests `if self.authority:`, so the '//' is dropped, and `file:///etc/hosts` becomes `file:/etc/hosts`. RFC 3986 5.3 says '//' is emitted whenever the authority is defined, even if empty, and normalization shouldn't change a URI's structure. I read the source and found no test or documentation saying the drop is intended. I could not run the code (Bash was denied), so this rests on reading the source and the counterhound run, which failed 3/3. The fix is delicate because it has to tell None from '' for authority across parsing, normalization and unsplit, which is why I'm only moderately confident a maintainer would take it.

## How it was found

Property: *normalizing a URI preserves its component structure; an empty-but-present authority stays '//'*.

Hypothesis shrank the failure to: `Failing test case: test_unsplit_roundtrip( # The test always failed when commented parts were varied together. u=(lambda s, a, p, q, f: (s + ':' if s else '') + ('//' + a if a is not None else '') + (('/' if a is not None and p and (not p.startswith('/')) else '') + p) + ('?' + q if q is not None el`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
