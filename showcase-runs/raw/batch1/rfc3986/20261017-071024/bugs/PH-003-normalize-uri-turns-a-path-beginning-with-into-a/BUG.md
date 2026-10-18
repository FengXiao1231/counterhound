# normalize_uri turns a path beginning with '//' into an authority when the URI has no authority

| | |
|---|---|
| Function | `rfc3986.api.normalize_uri` in `src/rfc3986/api.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.70, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** a:/.//b

**Expected:** a path of '//b' with no authority (e.g. 'a:/.//b' or 'a:/%2F...' style form); result must not re-parse with authority 'b'

**Actual:** 'a://b', which parses as scheme 'a', authority 'b', no path

## Reproduce

```python
from rfc3986.api import normalize_uri, uri_reference


def test_repro_path_becomes_authority():
    # path "/.//b" normalizes to "//b"; with no authority the result
    # "a://b" re-parses with host "b" instead of path "//b".
    n = normalize_uri("a:/.//b")
    assert uri_reference(n).authority is None
```

Fails with `AssertionError: assert 'b' is None`

## Why this is a bug

RFC 3986 section 3.3: when no authority is present the path cannot begin with '//'; section 6.2.2 normalization must be semantics-preserving. remove_dot_segments produces '//b' and unsplit() concatenates it directly after 'a:'.

Independent review: 'a:/.//b' is a valid URI: scheme 'a', no authority, path '/.//b'. Normalization runs remove_dot_segments to get '//b', and unsplit() then emits 'a:' followed by '//b'. That string re-parses with authority 'b' and no path, so normalization changed the URI's meaning, which RFC 3986 §6.2 forbids and §3.3 rules out for a no-authority path. This is a narrow edge case, and a fix is small: when there is no authority and the path starts with '//', keep a '/.' prefix as the WHATWG URL spec does, or skip dot-segment removal that would create the leading '//'. I couldn't run the repro myself because shell access was denied, so this rests on reading the source and on the harness's three failing runs.

## How it was found

Property: *normalized URI re-parses with the same authority presence as the input*.


---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
