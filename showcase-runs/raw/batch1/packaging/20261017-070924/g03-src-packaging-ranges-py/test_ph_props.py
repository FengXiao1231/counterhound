from hypothesis import given, assume, settings, strategies as st
from packaging.ranges import VersionRange
from packaging.specifiers import SpecifierSet
from packaging.version import Version

rel = st.lists(st.integers(0, 3), min_size=1, max_size=3).map(
    lambda xs: ".".join(map(str, xs)))
suffix = st.sampled_from(["", "", "", "a1", "b2", "rc1", ".dev0", ".dev1", ".post1", "a1.dev0", ".post1.dev0"])
local = st.sampled_from(["", "", "", "+x", "+1.a"])
epoch = st.sampled_from(["", "", "", "1!"])
versions = st.builds(lambda e, r, s, l: Version(e + r + s + l), epoch, rel, suffix, local)
pub = st.builds(lambda r, s: Version(r + s), rel, suffix)
policy = st.sampled_from([None, True, False])


@st.composite
def ranges(draw, pol=None):
    n = draw(st.integers(0, 2))
    r = None
    kind = draw(st.integers(0, 3))
    if kind == 0:
        return VersionRange.full(admit_arbitrary=draw(st.booleans()), prereleases=pol)
    if kind == 1:
        return VersionRange.empty(prereleases=pol)
    if kind == 2:
        return VersionRange.singleton(draw(versions), prereleases=pol)
    ops = st.sampled_from([">=", "<=", ">", "<", "==", "!=", "~="])
    parts = []
    for _ in range(draw(st.integers(1, 2))):
        op = draw(ops)
        v = draw(rel)
        if op == "~=":
            v = v + ".0" if "." not in v else v
        parts.append(op + v)
    ss = SpecifierSet(",".join(parts), prereleases=pol)
    return ss.to_range()


def mem(r, v):
    return r.contains(v, prereleases=True)


@st.composite
def pair(draw):
    pol = draw(policy)
    return draw(ranges(pol)), draw(ranges(pol))


@given(pair(), st.lists(versions, max_size=8))
def test_intersection(p, vs):
    a, b = p
    c = a & b
    for v in vs:
        assert mem(c, v) == (mem(a, v) and mem(b, v)), v


@given(pair(), st.lists(versions, max_size=8))
def test_union(p, vs):
    a, b = p
    c = a | b
    for v in vs:
        assert mem(c, v) == (mem(a, v) or mem(b, v)), v


@given(pair(), st.lists(versions, max_size=8))
def test_difference(p, vs):
    a, b = p
    c = a - b
    for v in vs:
        assert mem(c, v) == (mem(a, v) and not mem(b, v)), v


@given(pair())
def test_difference_vs_intersection_complement(p):
    a, b = p
    c = a - b
    d = a & ~b
    assert c._bounds == d._bounds


@given(pair(), st.lists(versions, max_size=8))
def test_disjoint(p, vs):
    a, b = p
    d = a.is_disjoint(b)
    assert d == (a & b).is_empty
    if d:
        for v in vs:
            assert not (a.contains(v) and b.contains(v))
    for v in vs:
        if a.contains(v) and b.contains(v):
            assert not d


@given(pair())
def test_disjoint_symmetric(p):
    a, b = p
    assert a.is_disjoint(b) == b.is_disjoint(a)


@given(versions, policy, st.lists(versions, max_size=8))
def test_singleton(v, pol, vs):
    s = VersionRange.singleton(v, prereleases=pol)
    assert s.contains(v, prereleases=True)
    for w in vs:
        assert mem(s, w) == (w == v), (v, w)
    assert not s.is_empty or (pol is False and v.is_prerelease)


@given(versions, policy)
def test_singleton_str(v, pol):
    assert VersionRange.singleton(str(v), prereleases=pol) == VersionRange.singleton(v, prereleases=pol)


@given(st.booleans(), policy, st.lists(versions, max_size=8))
def test_full(arb, pol, vs):
    f = VersionRange.full(admit_arbitrary=arb, prereleases=pol)
    for v in vs:
        assert mem(f, v)
    assert not f.is_empty
    assert ("wat" in f) == arb


@given(pair())
def test_idempotent_commutative(p):
    a, b = p
    assert (a & a)._bounds == a._bounds
    assert (a | a)._bounds == a._bounds
    assert (a & b)._bounds == (b & a)._bounds
    assert (a | b)._bounds == (b | a)._bounds
    assert (a - a).is_empty


@given(pair())
def test_empty_identity(p):
    a, _ = p
    pol = a._prereleases_configured
    e = VersionRange.empty(prereleases=pol)
    f = VersionRange.full(prereleases=pol)
    assert (a | e) == a or (a | e)._bounds == a._bounds
    assert (a & f)._bounds == a._bounds
    assert (a & e).is_empty
    assert (a - f).is_empty
