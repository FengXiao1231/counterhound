# Positional fields after a {:%...%z} datetime field are shifted because %z's capture groups are not counted

| | |
|---|---|
| Function | `parse.get_regex_for_datetime_format` in `parse/__init__.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity medium |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** parse('{:%Y-%m-%d %H:%M:%S%z}|{}', '2020-03-04 05:06:07+0200|abc')

**Expected:** r[1] == 'abc'

**Actual:** r[1] == '00' (or the call crashes with a TypeError for some formats), because the %z regex contains 2 capturing groups that Parser._handle_field does not count in _group_index

## Reproduce

```python
from parse import parse


def test_repro_tz_groups():
    r = parse("{:%Y-%m-%d %H:%M:%S%z}|{}", "2020-03-04 05:06:07+0200|abc")
    assert r is not None
    assert r[1] == "abc"
```

Fails with `AssertionError: assert '00' == 'abc'`

## Why this is a bug

Every other multi-group type increments _group_index for its internal groups; the datetime branch does not, so positional fixed-field indices become wrong. The %z pattern should use non-capturing groups (?:...).

Independent review: The `%z` entry in `dt_format_to_regex` is `[+|-][0-9]{2}(:?[0-9]{2})?(:?[0-9]{2})?`, which has two capturing groups. The generic datetime branch (`elif any(k in type for k in dt_format_to_regex)`) never adds them to `_group_index`, although the `n`, `b`, `o`, `x`, `%`, `g`, `ti` and `tg` branches all count their internal groups. Positional fields after the datetime field are therefore read from the wrong group: the report's input parses `r[1]` as '00' instead of 'abc', and a format that makes the lookup land on a missing or None group can raise a TypeError. The input and the expectation are both reasonable, since a datetime field followed by `{}` is ordinary use. Making the `%z` groups non-capturing, as the `f` branch already does, would fix it.

## How it was found

Property: *fields following a {:%...%z} field are parsed to their own text*.

Hypothesis shrank the failure to: `Failing test case: test_dt_then_fixed( f='%Y-%m-%d %H:%M:%S%z', )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
