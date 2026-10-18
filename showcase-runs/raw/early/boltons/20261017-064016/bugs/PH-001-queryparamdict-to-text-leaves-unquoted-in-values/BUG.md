# QueryParamDict.to_text leaves ';' unquoted in values, but parse_qsl splits pairs on ';'

| | |
|---|---|
| Function | `boltons.urlutils.QueryParamDict.to_text` in `boltons/urlutils.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.72, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** QueryParamDict([('a', 'b;c')]).to_text(full_quote=True)

**Expected:** ';' within a value is percent-encoded (%3B), so parsing the output returns [('a', 'b;c')]

**Actual:** Output is 'a=b;c', which from_text parses as [('a', 'b'), ('c', None)]

## Reproduce

```python
from boltons.urlutils import QueryParamDict


def test_repro_semicolon():
    d = QueryParamDict([('a', 'b;c')])
    text = d.to_text(full_quote=True)
    assert QueryParamDict.from_text(text).items(multi=True) == [('a', 'b;c')], text
```

Fails with `AssertionError: a=b;c`

## Why this is a bug

to_text docs: full_quote=True percent-quotes special characters (fully-quoted URLs are 'necessary for sending over the network'). _QUERY_SAFE keeps sub-delims such as ';' unquoted, while parse_qsl in the same module splits on both '&' and ';', so the two halves of the module disagree and data is corrupted.

Independent review: _QUERY_SAFE removes only '&', '=' and '+' from the safe set, so ';' is written raw. The module's own parse_qsl splits on both '&' and ';', so QueryParamDict.from_text(to_text(d)) turns ('a','b;c') into ('a','b'),('c',None). This silently corrupts data, and the loss happens even with full_quote=True, which is meant for sending over the network. Nothing in the tests relies on ';' staying unquoted in query values. Quoting ';' in query parts (or dropping the ';' split in parse_qsl, as CPython did) is a small change a maintainer would likely accept.

## How it was found

Property: *from_text(to_text(d)) gives back the same items as d, for any string keys/values and either full_quote setting*.

Hypothesis shrank the failure to: `Failing test case: test_qp_roundtrip_blank( pairs=[( '0', # or any other generated value ';', )], )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
