import warnings
from hypothesis import given, assume, settings, strategies as st
from rfc3986.api import normalize_uri, urlparse, is_valid_uri, uri_reference, iri_reference

warnings.simplefilter("ignore")
seg = st.text(alphabet="abcXYZ019-._~", max_size=6)
pct = st.sampled_from(["%3a", "%3A", "%aB", "%AB", "%7e"])
part = st.one_of(seg, pct)
path_seg = st.lists(part, max_size=4).map("".join)
path = st.lists(path_seg | st.sampled_from([".", ".."]), max_size=5).map("/".join)
scheme = st.from_regex(r"[A-Za-z][A-Za-z0-9+.-]{0,5}", fullmatch=True)
host = st.one_of(st.from_regex(r"[A-Za-z0-9.-]{1,10}", fullmatch=True),
                 st.just("[::1]"), st.just("127.0.0.1"), st.just(""))
port = st.one_of(st.just(""), st.integers(0, 65535).map(str))
auth = st.builds(lambda u, h, p: (u + "@" if u else "") + h + (":" + p if p else ""),
                 st.one_of(st.just(""), seg), host, port)
uris = st.builds(
    lambda s, a, p, q, f: (s + ":" if s else "") + ("//" + a if a is not None else "")
    + (("/" if a is not None and p and not p.startswith("/") else "") + p)
    + ("?" + q if q is not None else "") + ("#" + f if f is not None else ""),
    st.one_of(st.none(), scheme).map(lambda x: x or ""), st.one_of(st.none(), auth), path,
    st.one_of(st.none(), path_seg), st.one_of(st.none(), path_seg))

@given(uris)
def test_idempotent(u):
    n = normalize_uri(u)
    assert normalize_uri(n) == n

@given(uris)
def test_matches_composition(u):
    assert normalize_uri(u) == uri_reference(u).normalize().unsplit()

@given(uris)
def test_bytes_same(u):
    assert normalize_uri(u.encode()) == normalize_uri(u)

@given(uris)
def test_unsplit_roundtrip(u):
    assert uri_reference(u).unsplit() == u

@given(uris)
def test_normalize_preserves_authority_presence(u):
    r = uri_reference(u)
    n = uri_reference(normalize_uri(u))
    assert (r.authority is not None) == (n.authority is not None)

@given(uris)
def test_urlparse_roundtrip(u):
    assert urlparse(u).geturl() == u

@given(uris)
def test_valid_agrees(u):
    assert is_valid_uri(u) == uri_reference(u).is_valid()

@given(uris)
def test_scheme_lower(u):
    assert (uri_reference(normalize_uri(u)).scheme or None) == ((uri_reference(u).scheme or "").lower() or None)

@given(uris)
def test_iri_no_crash(u):
    iri_reference(u).unsplit()
