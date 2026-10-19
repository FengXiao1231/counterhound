TITLE: ParseResultBytes.unsplit() raises AttributeError for a reference without an authority
REPO: python-hyper/rfc3986
SEARCH: ParseResultBytes unsplit AttributeError
BODY:
```python
>>> from rfc3986.parseresult import ParseResult, ParseResultBytes
>>> ParseResult.from_string("/a").unsplit()
'/a'
>>> ParseResultBytes.from_string(b"/a").unsplit()
AttributeError: 'NoneType' object has no attribute 'encode'
```

Any reference without an authority (`/a`, `a`, `mailto:x`, `?q`) crashes the bytes variant, while the str variant round-trips. Reproduced on 2.0.0 (main 3bd3832).

The traceback goes through `ParseResultBytes.unsplit` → `URIReference.unsplit` → `normalizers.encode_component`/authority handling with `None` where `bytes` is expected; the str path guards against the missing authority, the bytes path does not.

Happy to send a PR with a test if you would take one.
