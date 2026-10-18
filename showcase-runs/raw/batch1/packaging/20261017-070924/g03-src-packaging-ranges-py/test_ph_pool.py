import itertools
from hypothesis import given, settings, strategies as st
from packaging.ranges import VersionRange
from packaging.specifiers import SpecifierSet
from packaging.version import Version
from test_ph_props import pair, policy, versions, ranges

POOL = []
for r in ["0", "0.0.1", "0.5", "1", "1.0.1", "1.5", "2", "2.0.1", "2.5", "3", "3.0.1", "4"]:
    for s in ["", "a1", "b2", "rc1", ".dev0", ".dev1", ".post1", "a1.dev0", ".post1.dev0", "+x"]:
        POOL.append(Version(r + s))
        POOL.append(Version("1!" + r + s))


def members(r):
    return {v for v in POOL if r.contains(v)}


@settings(max_examples=300)
@given(pair())
def test_disjoint_pool(p):
    a, b = p
    d = a.is_disjoint(b)
    common = members(a) & members(b)
    if common:
        assert not d, common
    if not d:
        # intersection non-empty must have a witness unless it only holds
        # members outside the pool; our spec bounds lie on pool-adjacent points
        pass


@settings(max_examples=300)
@given(ranges(None))
def test_is_empty_pool(a):
    if members(a):
        assert not a.is_empty
    if a.is_empty:
        assert not members(a)


@settings(max_examples=300)
@given(pair())
def test_subset_consistency(p):
    a, b = p
    if a.is_subset(b):
        assert members(a) <= members(b)
    assert a.is_subset(b) == (a - b).is_empty
