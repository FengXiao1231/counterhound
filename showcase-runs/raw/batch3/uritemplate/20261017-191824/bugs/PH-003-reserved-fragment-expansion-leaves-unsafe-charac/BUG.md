# Reserved/fragment expansion leaves unsafe characters unencoded when the value contains any percent-escape

| | |
|---|---|
| Function | `uritemplate.variable.Operator.quote` in `uritemplate/variable.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.70, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Operator.reserved.quote('a b%41')

**Expected:** 'a%20b%41'

**Actual:** 'a b%41' (value returned unchanged because unquote(value) != value)

## Reproduce

```python
from uritemplate.variable import Operator


def test_repro_reserved_space():
    assert Operator.reserved.quote("a b%41") == "a%20b%41"
```

Fails with `AssertionError: assert 'a b%41' == 'a%20b%41'`

Save it as `test_repro_reserved_space.py` in your tests and run `pytest test_repro_reserved_space.py`.

## Why this is a bug

RFC 6570 3.2.3: reserved expansion passes through only pct-encoded triplets and reserved/unreserved characters; every other character (e.g. space) must be percent-encoded.

Independent review: RFC 6570 §3.2.3 lets `{+var}` and `{#var}` pass through only reserved characters, unreserved characters and existing pct-encoded triplets. `_only_quote_unquoted_characters` is all-or-nothing: if `unquote(value) != value` it returns the whole value untouched. So `'a b%41'` comes out with a raw space, which is not a valid URI, while `'a b'` correctly becomes `'a%20b'`. The heuristic is deliberate, and the spec fixtures only cover values with no escapes or with a bare `%`. It is still a real spec deviation, and a regex-based fix that quotes everything except valid `%XX` triplets is simple, though a maintainer might treat it as a low-priority edge case.

## How it was found

Property: *output of {+var} contains no characters outside reserved/unreserved/pct-encoded*.

Hypothesis shrank the failure to: `Failing test case: test_reserved_quote_encodes_spaces( s=' %aa', )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
