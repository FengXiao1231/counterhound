import io

from hypothesis import given, settings, strategies as st
from sqlparse.lexer import Lexer, tokenize
from sqlparse import tokens as T

alpha = st.text(alphabet=list("$/*-+#'\"\\ \n\r\tabAB_1.;:(),é"), max_size=30)
anytext = st.text(max_size=40)


@given(anytext)
def test_roundtrip_any(s):
    assert "".join(v for _, v in tokenize(s)) == s


@given(alpha)
def test_roundtrip_delims(s):
    assert "".join(v for _, v in tokenize(s)) == s


@given(alpha)
def test_no_empty_tokens(s):
    assert all(v for _, v in tokenize(s))


@given(alpha)
def test_bytes_equals_str(s):
    assert list(tokenize(s.encode())) == list(tokenize(s))


@given(alpha)
def test_deterministic(s):
    assert list(tokenize(s)) == list(tokenize(s))


@given(alpha, alpha)
def test_concat_roundtrip(a, b):
    s = a + "\n" + b
    assert "".join(v for _, v in tokenize(s)) == s


@given(st.text(alphabet="abc_1é", min_size=1, max_size=6),
       st.text(alphabet="abc _;", max_size=10))
def test_dollar_case(tag, body):
    s = f"${tag}${body}${tag.swapcase()}$"
    assert "".join(v for _, v in tokenize(s)) == s


@given(st.text(alphabet=list("abcSELECT "), min_size=1, max_size=8))
def test_is_keyword(v):
    l = Lexer.get_default_instance()
    t, val = l.is_keyword(v)
    assert val == v
    assert l.is_keyword(v.lower())[0] == l.is_keyword(v.upper())[0]


def test_clear_and_empty():
    l = Lexer()
    l.clear()
    assert list(l.get_tokens("abc")) == [(T.Error, "a"), (T.Error, "b"), (T.Error, "c")]


def test_add_keywords_order():
    l = Lexer()
    l.default_initialization()
    l.add_keywords({"ZZQQ": T.Keyword})
    assert l.is_keyword("zzqq")[0] is T.Keyword
    assert l.is_keyword("zzqqx")[0] is T.Name


@given(alpha)
def test_stringio(s):
    assert list(tokenize(io.StringIO(s))) == list(tokenize(s))
