from hypothesis import given, assume, settings, strategies as st
from furl.furl import idna_encode, idna_decode, Query, Path, furl, remove_path_segments

label = st.text(alphabet=st.characters(whitelist_categories=('Ll','Nd'), max_codepoint=0x24f), min_size=1, max_size=10)
host = st.lists(label, min_size=1, max_size=3).map('.'.join)

@given(host)
def test_idna_roundtrip(h):
    assert idna_decode(idna_encode(h)) == h.lower()

@given(st.lists(st.text(alphabet='ab', max_size=2), max_size=5))
def test_path_load_other_path_not_mutated(segs):
    p1 = Path(); p1.segments = list(segs); p1._isabsolute = True
    before = list(p1.segments)
    Path().load(p1)
    assert p1.segments == before

@given(st.lists(st.text(alphabet='ab', max_size=1), max_size=5), st.lists(st.text(alphabet='ab', max_size=1), max_size=5))
def test_remove_no_mutation(a, b):
    a0, b0 = list(a), list(b)
    remove_path_segments(a, b)
    assert a == a0 and b == b0

@given(st.lists(st.tuples(st.text(max_size=4), st.text(max_size=4)), max_size=4))
def test_query_roundtrip(items):
    q = Query(items)
    q2 = Query(q.encode())
    assert q2.params.allitems() == [(k, v) for k, v in items]

@given(st.lists(st.tuples(st.text(max_size=4), st.text(max_size=4)), max_size=4), st.sampled_from(['&',';']), st.booleans())
def test_query_encode_stable(items, d, qp):
    s = Query(items).encode(delimiter=d, quote_plus=qp)
    assert Query(s).encode(delimiter=d, quote_plus=qp) == s

@given(st.text(alphabet='abc/.:@?#=&', max_size=12))
def test_furl_load_idempotent(s):
    f = furl('http://example.com/' + s)
    assert furl(f.url).url == f.url
