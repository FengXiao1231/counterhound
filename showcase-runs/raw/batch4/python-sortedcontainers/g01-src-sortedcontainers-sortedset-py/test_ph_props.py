from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, precondition
from sortedcontainers.sortedset import SortedSet

ints = st.lists(st.integers(-20, 20), max_size=40)
keys = st.sampled_from([None, lambda x: -x, lambda x: x % 5, abs])


def ok(ss, model):
    ss._check()
    assert set(ss) == set(model)
    assert len(ss) == len(model)
    assert list(ss) == sorted(ss, key=ss.key) or ss.key is not None
    ks = [ss.key(v) if ss.key else v for v in ss]
    assert ks == sorted(ks)


@given(ints, st.lists(ints, max_size=3), keys)
def test_difference(a, its, k):
    s = SortedSet(a, key=k)
    r = s.difference(*its)
    ok(r, set(a).difference(*its))
    ok(s, set(a))
    assert r.key == s.key


@given(ints, st.lists(ints, max_size=3), keys)
def test_difference_update(a, its, k):
    s = SortedSet(a, key=k)
    assert s.difference_update(*its) is s
    ok(s, set(a).difference(*its))


@given(ints, st.lists(ints, min_size=1, max_size=3), keys)
def test_intersection(a, its, k):
    s = SortedSet(a, key=k)
    ok(s.intersection(*its), set(a).intersection(*its))


@given(ints, st.lists(ints, max_size=3), keys)
def test_intersection_update(a, its, k):
    s = SortedSet(a, key=k)
    assert s.intersection_update(*its) is s
    ok(s, set(a).intersection(*its))


@given(ints, ints, keys)
def test_symdiff(a, b, k):
    s = SortedSet(a, key=k)
    ok(s.symmetric_difference(b), set(a) ^ set(b))
    s.symmetric_difference_update(b)
    ok(s, set(a) ^ set(b))


@given(ints, keys)
def test_self_ops(a, k):
    s = SortedSet(a, key=k)
    s2 = s.copy()
    s2.symmetric_difference_update(s2)
    ok(s2, set())
    s2 = s.copy()
    s2.difference_update(s2)
    ok(s2, set())
    s2 = s.copy()
    s2.intersection_update(s2)
    ok(s2, set(a))


class M(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.s = SortedSet(key=lambda x: -x)
        self.m = set()

    @rule(v=st.integers(-10, 10))
    def add(self, v):
        self.s.add(v); self.m.add(v)

    @rule(v=st.integers(-10, 10))
    def discard(self, v):
        self.s.discard(v); self.m.discard(v)

    @rule(v=st.integers(-10, 10))
    def remove(self, v):
        if v in self.m:
            self.s.remove(v); self.m.remove(v)

    @precondition(lambda self: self.m)
    @rule(i=st.integers(0, 50))
    def pop(self, i):
        i %= len(self.m)
        self.m.remove(self.s.pop(i))

    @rule()
    def clear(self):
        self.s.clear(); self.m.clear()

    @rule(o=ints)
    def dup(self, o):
        self.s.difference_update(o); self.m -= set(o)

    @rule(o=ints)
    def iu(self, o):
        self.s.intersection_update(o); self.m &= set(o)

    @rule(o=ints)
    def sdu(self, o):
        self.s.symmetric_difference_update(o); self.m ^= set(o)

    @rule(o=ints)
    def up(self, o):
        self.s.update(o); self.m |= set(o)

    @invariant()
    def inv(self):
        ok(self.s, self.m)
        assert self.s.copy() == self.m


TestM = M.TestCase
