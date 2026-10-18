from hypothesis import given, assume, settings, strategies as st
from semver.version import Version

num = st.integers(0, 10**6)
ident = st.one_of(st.just("0"), st.from_regex(r"[1-9][0-9]{0,5}", fullmatch=True),
                  st.from_regex(r"[0-9]{0,3}[a-zA-Z-][0-9a-zA-Z-]{0,4}", fullmatch=True))
pre = st.lists(ident, min_size=1, max_size=4).map(".".join)
bid = st.from_regex(r"[0-9a-zA-Z-]{1,6}", fullmatch=True)
build = st.lists(bid, min_size=1, max_size=3).map(".".join)
vers = st.builds(Version, num, num, num, st.none() | pre, st.none() | build)
tok = ident


@given(vers)
def test_roundtrip(v):
    p = Version.parse(str(v))
    assert p.to_tuple() == v.to_tuple()
    assert Version.parse(str(v), optional_minor_and_patch=True) == p


@given(vers, st.sampled_from(["major", "minor", "patch", "prerelease"]), tok)
def test_next_greater(v, part, t):
    n = v.next_version(part, t)
    assert n > v
    assert Version.parse(str(n)) == n


@given(vers, tok)
def test_next_prerelease_token(v, t):
    n = v.next_version("prerelease", t)
    assert n.prerelease.startswith(t)


@given(vers, tok, st.booleans())
def test_bump_prerelease(v, t, w):
    n = v.bump_prerelease(t, w)
    assert n > v or (v.prerelease is None and not w and n < v)
    Version.parse(str(n))


@given(vers, tok)
def test_bump_build(v, t):
    n = v.bump_build(t)
    Version.parse(str(n))
    assert n.build != v.build
    assert n.to_tuple()[:4] == v.to_tuple()[:4]


@given(vers, vers)
def test_match(a, b):
    c = a.compare(b)
    for op, ok in [(">", c > 0), ("<", c < 0), (">=", c >= 0), ("<=", c <= 0), ("==", c == 0), ("!=", c != 0)]:
        assert a.match(op + str(b)) == ok
    assert a.match(str(b)) == (c == 0)


@given(vers, vers)
def test_compat(a, b):
    r = a.is_compatible(b)
    if a == b:
        assert r
    if a.major != b.major:
        assert not r


@given(vers, vers)
def test_hash_eq(a, b):
    if a == b:
        assert hash(a) == hash(b)


@given(vers, vers, vers)
def test_order_trans(a, b, c):
    if a <= b <= c:
        assert a <= c
