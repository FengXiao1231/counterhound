TITLE: normalize_uri turns a path that begins with "//" into an authority when the URI has none
REPO: python-hyper/rfc3986
SEARCH: normalize_uri path authority dot segments
BODY:
```python
>>> from rfc3986.api import normalize_uri, uri_reference
>>> normalize_uri("a:/.//b")
'a://b'
>>> uri_reference("a://b").authority
'b'
```

`a:/.//b` has no authority and the path `/.//b`. Dot-segment removal correctly produces the path `//b`, but the normalized string is then rebuilt as `a:` + `//b`, which re-parses with host `b` and an empty path: a different URI. RFC 3986 §5.2.4 and §4.2 warn about exactly this case: when the path starts with `//` and there is no authority, the first segment must be protected, for example as `a:/.//b` (keep the `/.` prefix, as the WHATWG URL standard does) or by percent-encoding one slash.

Reproduced on 2.0.0 (main 3bd3832). Happy to send a PR with a test if you would take one.
