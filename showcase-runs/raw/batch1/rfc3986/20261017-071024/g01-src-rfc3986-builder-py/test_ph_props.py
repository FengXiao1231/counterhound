from urllib.parse import parse_qsl, unquote
from hypothesis import given, assume, strategies as st
from rfc3986.builder import URIBuilder
import rfc3986

seg = st.text(alphabet="abcXYZ019-._~", min_size=1, max_size=5)
key = st.text(alphabet="abcXYZ019", min_size=1, max_size=4)
val = st.text(alphabet="abcXYZ019 &=;+%é", max_size=4)
items = st.lists(st.tuples(key, val), max_size=4)


@given(st.lists(seg, max_size=3), st.lists(seg, max_size=3))
def test_extend_path(a, b):
    base = "/" + "/".join(a)
    r = URIBuilder(path=base).extend_path("/".join(b))
    assert r.path.startswith("/")
    assert r.path == URIBuilder().add_path(base.rstrip("/") + "/" + "/".join(b)).path


@given(st.text(alphabet="abc/%2Fe", max_size=8))
def test_add_path_leading_slash_idempotent(p):
    r = URIBuilder().add_path(p)
    assert r.path.startswith("/")
    assert URIBuilder().add_path(r.path).path == r.path


@given(st.text(max_size=6), st.one_of(st.none(), st.text(max_size=6)))
def test_credentials_roundtrip(u, p):
    assume(u)
    b = URIBuilder().add_credentials(u, p).add_host("h")
    ref = rfc3986.uri_reference(b.geturl())
    got_u, _, got_p = ref.userinfo.partition(":")
    assert unquote(got_u) == u
    if p is not None:
        assert unquote(got_p) == p


@given(items)
def test_add_query_roundtrip(it):
    b = URIBuilder().add_query_from(it)
    assert parse_qsl(b.query or "", keep_blank_values=True) == list(it)


@given(items, items)
def test_extend_query(a, b):
    base = URIBuilder().add_query_from(a)
    r = base.extend_query_with(b)
    assert parse_qsl(r.query or "", keep_blank_values=True) == list(a) + list(b)


@given(items, st.dictionaries(key, val, max_size=3))
def test_extend_query_dict(a, d):
    base = URIBuilder().add_query_from(a)
    r = base.extend_query_with(d)
    assert parse_qsl(r.query or "", keep_blank_values=True) == list(a) + list(d.items())


@given(st.sampled_from(["http://a.com/p?q=1#f", "https://u:p@h:80/a/b", "/x/y", "?a=b", "", "//h"]))
def test_from_uri(s):
    assert URIBuilder.from_uri(s).geturl() == rfc3986.uri_reference(s).unsplit()
