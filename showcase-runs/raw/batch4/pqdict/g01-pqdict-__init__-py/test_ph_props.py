import importlib.metadata as _md

_orig_version = _md.version
_md.version = lambda n: "0" if n == "pqdict" else _orig_version(n)

import pytest
from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, precondition
from pqdict import pqdict, Empty, nlargest, nsmallest

items = st.dictionaries(st.integers(-20, 20), st.integers(-50, 50))
rev = st.booleans()


def mk(d, r):
    return pqdict(d, reverse=r)


@given(items, rev)
def test_top_family(d, r):
    p = mk(d, r)
    if not d:
        for f in (p.top, p.topvalue, p.topitem):
            with pytest.raises(Empty):
                f()
            assert f("x") == "x"
        return
    best = (max if r else min)(d.values())
    k = p.top()
    assert d[k] == best and p.topvalue() == best and p.topitem() == (k, best)
    assert len(p) == len(d)


@given(items, rev)
def test_popitems_sorted(d, r):
    p = mk(d, r)
    out = list(p.popitems())
    assert [v for _, v in out] == sorted(d.values(), reverse=r)
    assert dict(out) == d and len(p) == 0


@given(items, rev)
def test_popkeys_values(d, r):
    assert [d[k] for k in mk(d, r).popkeys()] == sorted(d.values(), reverse=r)
    assert list(mk(d, r).popvalues()) == sorted(d.values(), reverse=r)


@given(items, rev, st.integers(-20, 20), st.integers(-50, 50))
def test_updateitem(d, r, k, v):
    p = mk(d, r)
    if k not in d:
        with pytest.raises(KeyError):
            p.updateitem(k, v)
        assert dict(p) == d
        return
    p.updateitem(k, v)
    d = dict(d)
    d[k] = v
    assert dict(p.items()) == d
    assert [x for _, x in p.popitems()] == sorted(d.values(), reverse=r)


@given(st.lists(st.integers(-5, 5)), st.integers(), rev)
def test_fromkeys(ks, v, r):
    p = pqdict.fromkeys(ks, v, reverse=r)
    assert dict(p) == {k: v for k in ks}


@given(items, st.integers(0, 25))
def test_nlargest_nsmallest(d, n):
    a = nlargest(n, d)
    b = nsmallest(n, d)
    assert [d[k] for k in a] == sorted(d.values(), reverse=True)[:n]
    assert [d[k] for k in b] == sorted(d.values())[:n]


class M(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.p = pqdict(reverse=True)
        self.m = {}

    @rule(k=st.integers(0, 6), v=st.integers(-9, 9))
    def setit(self, k, v):
        self.p[k] = v
        self.m[k] = v

    @rule(k=st.integers(0, 6), v=st.integers(-9, 9))
    def add(self, k, v):
        if k in self.m:
            with pytest.raises(KeyError):
                self.p.additem(k, v)
        else:
            self.p.additem(k, v)
            self.m[k] = v

    @rule(k=st.integers(0, 6))
    def delete(self, k):
        if k in self.m:
            del self.p[k]
            del self.m[k]

    @rule(k=st.integers(0, 6), v=st.integers(-9, 9))
    def pushpop(self, k, v):
        if k in self.m:
            return
        rk, rv = self.p.pushpopitem(k, v)
        self.m[k] = v
        assert rv == max(self.m.values())
        assert self.m[rk] == rv
        del self.m[rk]

    @rule(a=st.integers(0, 6), b=st.integers(0, 6))
    def swap(self, a, b):
        if a in self.m and b in self.m:
            self.p.swap_priority(a, b)
            self.m[a], self.m[b] = self.m[b], self.m[a]

    @rule(a=st.integers(0, 6), b=st.integers(7, 12))
    def rename(self, a, b):
        if a in self.m and b not in self.m:
            self.p.replace_key(a, b)
            self.m[b] = self.m.pop(a)

    @precondition(lambda s: s.m)
    @rule()
    def popit(self):
        k, v = self.p.popitem()
        assert v == max(self.m.values()) and self.m.pop(k) == v

    @rule()
    def cp(self):
        c = self.p.copy()
        assert dict(c) == self.m

    @invariant()
    def ok(self):
        assert dict(self.p.items()) == self.m
        if self.m:
            assert self.p.topvalue() == max(self.m.values())
        for k, pos in self.p._position.items():
            assert self.p._heap[pos].key == k


TestM = M.TestCase
