<!-- counterhound-report -->
### counterhound found 3 provable bugs

Checked 9 functions in 2 modules with property-based tests. 5 reported → 5 reproduced → 5 unique → 3 confirmed by an independent review.

<details><summary><b>PH-001</b> Prefix modifier (`{var:N}`) raises TypeError on int/float scalar values <sub>(crash, uritemplate/variable.py:450)</sub></summary>

| | |
|---|---|
| Function | `uritemplate.api.expand` |
| Input | expand('{a:1}', {'a': 12}) |
| Expected | '1' |
| Actual | TypeError: 'int' object is not subscriptable |
| Review | low severity, confidence 0.88 |

`ScalarVariableValue` explicitly includes int, float and complex, and `Operator.quote` already converts non-strings with `str()` (variable.py:159). So `{a}` with `a=12` works, but `{a:1}` slices the raw int at variable.py:450 (the same pattern appears at lines 315, 368 and 417) and raises `TypeError: 'int' object is not subscriptable`. RFC 6570 applies the prefix to the string form, so the expected result `'1'` is correct. The existing tests only use string values, so nothing documents the crash as intended, and a maintainer would likely accept a small `str(value)[:prefix]` fix.

Failing test (`test_repro_int_prefix.py`, failed 3/3 runs):

```python
from uritemplate.api import expand


def test_repro_int_prefix():
    assert expand("{a:1}", {"a": 12}) == "1"
```
</details>

<details><summary><b>PH-002</b> partial() keeps {var} in the template when the supplied value expands to an empty string <sub>(wrong result, uritemplate/api.py)</sub></summary>

| | |
|---|---|
| Function | `uritemplate.api.partial` |
| Input | partial('a{x}b', {'x': ''}) |
| Expected | URITemplate('ab'), same as expand |
| Actual | URITemplate('a{x}b') |
| Review | low severity, confidence 0.80 |

URITemplate._expand uses `expanded.get(match_group) or var` in replace_partial. That treats an empty expansion, which is what a supplied '' produces for `{x}`, the same as a variable that was never supplied. So `partial('a{x}b', {'x': ''})` returns `a{x}b` while `expand` returns `ab`. The docstring says only missing parameters should remain, and the fix is small: test whether the key is absent or the variable was supplied, instead of testing truthiness. The case is an edge one, but a maintainer would probably accept the fix.

Failing test (`test_repro_partial_empty.py`, failed 3/3 runs):

```python
from uritemplate.api import expand, partial


def test_repro_partial_empty():
    assert str(partial("a{x}b", {"x": ""})) == expand("a{x}b", {"x": ""}) == "ab"
```
</details>

<details><summary><b>PH-003</b> Reserved/fragment expansion leaves unsafe characters unencoded when the value contains any percent-escape <sub>(wrong result, uritemplate/variable.py)</sub></summary>

| | |
|---|---|
| Function | `uritemplate.variable.Operator.quote` |
| Input | Operator.reserved.quote('a b%41') |
| Expected | 'a%20b%41' |
| Actual | 'a b%41' (value returned unchanged because unquote(value) != value) |
| Review | low severity, confidence 0.70 |

RFC 6570 §3.2.3 lets `{+var}` and `{#var}` pass through only reserved characters, unreserved characters and existing pct-encoded triplets. `_only_quote_unquoted_characters` is all-or-nothing: if `unquote(value) != value` it returns the whole value untouched. So `'a b%41'` comes out with a raw space, which is not a valid URI, while `'a b'` correctly becomes `'a%20b'`. The heuristic is deliberate, and the spec fixtures only cover values with no escapes or with a bare `%`. It is still a real spec deviation, and a regex-based fix that quotes everything except valid `%XX` triplets is simple, though

Failing test (`test_repro_reserved_space.py`, failed 3/3 runs):

```python
from uritemplate.variable import Operator


def test_repro_reserved_space():
    assert Operator.reserved.quote("a b%41") == "a%20b%41"
```
</details>

2 more failures reproduced, but the reviewer was not sure they are bugs: Integer 0 expands as empty value in ? / & / ; expansions; Integer 0 expands as empty in {?x} and {;x}.

<sub>1m51s · $0.70 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
