# ParseResultBytes.unsplit() raises AttributeError for URIs without an authority

| | |
|---|---|
| Function | `rfc3986.parseresult.ParseResultBytes.unsplit` in `src/rfc3986/parseresult.py:409` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.93, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** ParseResultBytes.from_string(b"/a").unsplit()

**Expected:** b"/a" (as ParseResult.from_string("/a").unsplit() returns "/a")

**Actual:** `AttributeError: 'NoneType' object has no attribute 'encode'`

## Reproduce

```python
from rfc3986.parseresult import ParseResultBytes


def test_repro_bytes_unsplit_no_authority():
    pr = ParseResultBytes.from_string(b"/a")
    assert pr.unsplit() == b"/a"
```

Fails with `AttributeError: 'NoneType' object has no attribute 'encode'`

## Why this is a bug

unsplit is documented as ':returns: The parsed URI reconstituted as a string / :rtype: bytes'; the str counterpart ParseResult.unsplit and geturl() work for the same input, and authority-less URIs such as '/a', 'a:b', '?q' and '' are valid RFC 3986 references that from_string accepts. ParseResultMixin declares authority as Optional.

Independent review: I re-ran the repro and it fails as reported. `ParseResultBytes.authority` (parseresult.py:409) calls `self.reference.authority.encode(...)` with no None check, although `ParseResult.authority` and the mixin both declare the value Optional. `from_string` accepts authority-less references such as b'/a', and the str `unsplit` handles them. The default `lazy_normalize=True` path in `ParseResultBytes.unsplit` hits the crash on a plain relative path, which is a common input, so a maintainer would accept a small None-guard fix.

## How it was found

Property: *unsplitting a parsed relative/authority-less URI (bytes) returns the URI bytes instead of raising*.

Hypothesis shrank the failure to: `Failing test case: test_bytes_unsplit_vs_str( u='', lazy=True, )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
