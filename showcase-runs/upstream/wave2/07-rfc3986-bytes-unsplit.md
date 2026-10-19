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

The traceback: `unsplit` calls `copy_with(lazy_normalize=False)`, which calls `_generate_authority`, which reads the `authority` property, and that property does `self.reference.authority.encode(self.encoding)` (parseresult.py:409) without checking for `None`. The other bytes properties (`scheme`, `path`, …) are guarded the same way `authority` should be.

Happy to send a PR with a test if you would take one.
