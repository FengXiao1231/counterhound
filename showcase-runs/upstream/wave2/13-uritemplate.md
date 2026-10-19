TITLE: Prefix modifier crashes on non-string values; reserved expansion stops encoding once the value contains a percent-escape
REPO: python-hyper/uritemplate
SEARCH: prefix modifier TypeError reserved quote
BODY:
Two related problems in `uritemplate/variable.py`, reproduced on 4.2.0 (main 8e46228).

### 1. `{var:N}` with an int or float value raises TypeError

```python
>>> from uritemplate import expand
>>> expand("{a:1}", {"a": 12})
TypeError: 'int' object is not subscriptable
>>> expand("{a}", {"a": 12})
'12'
```

Non-string scalars are accepted everywhere else (they are converted with `str()` in `Operator.quote`), but the prefix is applied before that conversion: `value = value[:prefix] if prefix else value`. Converting first (`str(value)[:prefix]`) fixes it; RFC 6570 §2.4.1 defines the prefix on the string form of the value.

### 2. Reserved (`+`) and fragment (`#`) expansion leave unsafe characters unencoded if the value contains any `%XX`

```python
>>> from uritemplate import expand
>>> expand("{+a}", {"a": "a b"})
'a%20b'
>>> expand("{+a}", {"a": "a b%41"})
'a b%41'        # expected 'a%20b%41'
```

`Operator._only_quote_unquoted_characters` returns the value unchanged whenever `unquote(value) != value`, so one pre-existing percent-escape disables encoding for the whole string, including the space. RFC 6570 §3.2.3 says reserved expansion keeps existing pct-encoded triplets and encodes everything else that is not in reserved/unreserved; the check needs to be per character (or per triplet), not per string.

Happy to send a PR with tests for both if you would take one.
