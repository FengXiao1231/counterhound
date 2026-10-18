# URIBuilder.extend_query_with drops existing query parameters that have blank values

| | |
|---|---|
| Function | `rfc3986.builder.URIBuilder.extend_query_with` in `src/rfc3986/builder.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** URIBuilder(query='a=').extend_query_with([('b', 'c')])

**Expected:** query == 'a=&b=c'

**Actual:** query == 'b=c' (the existing 'a=' is lost); extending with [] turns 'a=' into ''

## Reproduce

```python
from rfc3986.builder import URIBuilder


def test_repro_extend_query_blank():
    b = URIBuilder(query="a=").extend_query_with([("b", "c")])
    assert b.query == "a=&b=c"
```

Fails with `AssertionError: assert 'b=c' == 'a=&b=c'`

## Why this is a bug

Docstring: 'Extend the existing query string with the new query items.' Existing items are parsed with parse_qsl(self.query) without keep_blank_values=True, so blank-valued params are discarded; extension should only add, never remove.

Independent review: extend_query_with parses the existing query with `parse_qsl(self.query or "")`. That call defaults to `keep_blank_values=False`, so `a=` is discarded, and extending with an empty list turns `a=` into an empty query. The docstring says it extends the existing query, and the examples show existing items being preserved. Losing data from a query that was already valid is not the intended behaviour. The tests I found don't cover blank values, so nothing suggests the drop is deliberate, and passing `keep_blank_values=True` is a one-line fix a maintainer would likely accept.

## How it was found

Property: *extending a query keeps all existing key/value pairs, including those with empty values, and appends the new ones*.

Hypothesis shrank the failure to: `Failing test case: test_extend_query( # The test always failed when commented parts were varied together. a=[( '0', # or any other generated value '', )], b=[], # or any other generated value )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
