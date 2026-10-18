from hypothesis import given, assume, settings, strategies as st
from rfc3986.parseresult import ParseResult, ParseResultBytes, split_authority
from rfc3986 import exceptions

unres = st.text("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~", min_size=1, max_size=6)
scheme = st.one_of(st.none(), st.builds(lambda a, b: a + b, st.text("abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=1), st.text("abcdefghijklmnopqrstuvwxyz0123456789+-.", max_size=5)))
host = st.one_of(st.none(), unres)
userinfo = st.one_of(st.none(), unres)
port = st.one_of(st.none(), st.integers(1, 65535))
segs = st.lists(unres, max_size=3).map(lambda l: "".join("/" + s for s in l))
query = st.one_of(st.none(), unres)
frag = st.one_of(st.none(), unres)


@st.composite
def uris(draw):
    s = draw(scheme)
    h = draw(host)
    u = draw(userinfo) if h else None
    p = draw(port) if h else None
    path = draw(segs)
    q = draw(query)
    f = draw(frag)
    out = ""
    if s:
        out += s + ":"
    if h is not None:
        out += "//"
        if u:
            out += u + "@"
        out += h
        if p:
            out += f":{p}"
    out += path
    if q is not None:
        out += "?" + q
    if f is not None:
        out += "#" + f
    return out


@given(uris(), st.booleans())
def test_str_unsplit_roundtrip(u, lazy):
    pr = ParseResult.from_string(u, lazy_normalize=lazy)
    out = pr.unsplit()
    ref = ParseResult.from_string(u).reference
    assert out == (u if lazy else ref.normalize().unsplit())


@given(uris())
def test_bytes_matches_str(u):
    a = ParseResult.from_string(u)
    b = ParseResultBytes.from_string(u)
    for x, y in zip(a, b):
        if isinstance(x, str):
            assert x.encode() == y
        else:
            assert x == y


@given(uris(), st.booleans())
def test_bytes_unsplit_vs_str(u, lazy):
    a = ParseResult.from_string(u, lazy_normalize=lazy)
    b = ParseResultBytes.from_string(u, lazy_normalize=lazy)
    assert b.unsplit().decode() == a.reference.normalize().unsplit() if b.lazy_normalize else True


@given(uris())
def test_encode_roundtrip(u):
    a = ParseResult.from_string(u)
    b = a.encode()
    assert tuple(b) == tuple(x.encode() if isinstance(x, str) else x for x in a)
    assert b.unsplit() == b.reference.normalize().unsplit().encode()


@given(uris())
def test_encode_unsplit_idna(u):
    a = ParseResult.from_string(u)
    assert a.unsplit(use_idna=True) is not None
    assert a.encode().unsplit(use_idna=True) is not None


@given(uris())
def test_idna_ascii_unchanged(u):
    a = ParseResult.from_string(u)
    assert a.unsplit(use_idna=True) == a.unsplit()


@given(st.text(max_size=15))
def test_split_authority_no_crash(a):
    try:
        ui, h, p = split_authority(a)
    except Exception as e:
        raise
    if "@" in a:
        assert ui == a.rsplit("@", 1)[0]


@given(st.one_of(st.none(), unres), unres, st.one_of(st.none(), st.integers(0, 65535)))
def test_split_authority_roundtrip(u, h, p):
    a = (u + "@" if u is not None else "") + h + (f":{p}" if p is not None else "")
    ui, hh, pp = split_authority(a)
    assert ui == u and hh == h and pp == (None if p is None else str(p))


@given(st.text("[]:@abc12.", max_size=10))
def test_split_authority_agrees_with_strict(a):
    from rfc3986 import uri
    ref = uri.URIReference(None, a, None, None, None)
    try:
        info = ref.authority_info()
    except exceptions.InvalidAuthority:
        return
    ui, h, p = split_authority(a)
    assert (ui, h, p) == (info["userinfo"], info["host"], info["port"])


@given(st.text(max_size=12), st.booleans())
def test_nonstrict_no_unexpected(s, lazy):
    try:
        ParseResult.from_string(s, strict=False, lazy_normalize=lazy)
    except (exceptions.RFC3986Exception, ValueError):
        pass
