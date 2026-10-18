from hypothesis import given, assume, strategies as st
from uritemplate.api import expand, partial, variables

names = st.from_regex(r"[a-z][a-z0-9_]{0,5}", fullmatch=True)
text = st.text(st.characters(blacklist_categories=("Cs",)), max_size=8)


@given(names, st.integers(min_value=0, max_value=10**6))
def test_int_query(n, v):
    assert expand("{?%s}" % n, {n: v}) == "?%s=%d" % (n, v)


@given(names, st.integers(min_value=0, max_value=10**6))
def test_int_semi(n, v):
    assert expand("{;%s}" % n, {n: v}) == ";%s=%d" % (n, v)


@given(names, st.integers(min_value=10, max_value=10**6), st.integers(1, 3))
def test_int_prefix(n, v, p):
    assert expand("{%s:%d}" % (n, p), {n: v}) == str(v)[:p]


@given(names, text)
def test_partial_full_equals_expand(n, v):
    assert str(partial("a{%s}b" % n, {n: v})) == expand("a{%s}b" % n, {n: v})


@given(names, names)
def test_variables(a, b):
    assert list(variables("x{/%s}{?%s}" % (a, b))) == list(dict.fromkeys([a, b]))


@given(names, text, text)
def test_kwargs_override(n, a, b):
    assert expand("{%s}" % n, {n: a}, **{n: b}) == expand("{%s}" % n, **{n: b})
