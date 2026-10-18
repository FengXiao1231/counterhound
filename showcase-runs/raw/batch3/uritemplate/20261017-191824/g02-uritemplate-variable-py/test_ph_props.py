from hypothesis import given, assume, strategies as st
from uritemplate.variable import Operator, URIVariable
import urllib.parse


@given(st.integers(min_value=0, max_value=1000))
def test_query_int_zero_and_ints(n):
    out = URIVariable("?x").expand({"x": n})["?x"]
    assert out == "?x=%d" % n


@given(st.integers(min_value=0, max_value=1000))
def test_semi_int(n):
    out = URIVariable(";x").expand({"x": n})[";x"]
    assert out == ";x=%d" % n


@given(st.integers(min_value=10, max_value=10**6))
def test_prefix_int(n):
    out = URIVariable("x:2").expand({"x": n})["x:2"]
    assert out == str(n)[:2]


@given(st.text(alphabet="ab %/", max_size=8))
def test_reserved_quote_encodes_spaces(s):
    out = Operator.reserved.quote(s)
    assert " " not in out


@given(st.sampled_from(list(Operator)), st.text(max_size=10))
def test_no_crash_str(op, s):
    op.quote(s)
