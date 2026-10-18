import urllib.parse
from hypothesis import given, assume, strategies as st
from boltons.urlutils import URL, QueryParamDict, unquote, parse_url, OrderedMultiDict

txt = st.text(st.characters(blacklist_categories=('Cs',)), max_size=8)
ne = txt.filter(bool)


@given(st.lists(st.tuples(ne, txt)))
def test_qp_roundtrip_blank(pairs):
    d = QueryParamDict(pairs)
    for fq in (False, True):
        r = QueryParamDict.from_text(d.to_text(full_quote=fq))
        assert [(k, v or None) for k, v in r.items(multi=True)] == [(k, v or None) for k, v in d.items(multi=True)]


@given(txt)
def test_unquote_matches_stdlib(s):
    assert unquote(s) == urllib.parse.unquote(s)


@given(st.lists(st.tuples(st.integers(), st.integers())), st.booleans())
def test_sorted(items, rev):
    o = OrderedMultiDict(items)
    assert o.sorted(reverse=rev).items(multi=True) == sorted(o.items(multi=True), reverse=rev)


seg = st.text(st.sampled_from("abc XYZ-._~%/?#&=+:@é"), max_size=6)


@given(seg, seg, seg, seg)
def test_url_roundtrip(path, k, v, frag):
    for fq in (False, True):
        u = URL('http://example.com')
        u.path_parts = ('', path)
        u.query_params.add(k or 'k', v)
        u.fragment = frag
        t = u.to_text(full_quote=fq)
        u2 = URL(t)
        assert u2.path_parts == u.path_parts, t
        assert u2.fragment == frag, t
        assert u2.to_text(full_quote=fq) == t
