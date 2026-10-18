from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, precondition
from ordered_set import OrderedSet

L = st.lists(st.integers(-5, 8), max_size=12)


def dedup(x):
    return list(dict.fromkeys(x))


@given(L, L)
def test_symdiff(a, b):
    r = OrderedSet(a).symmetric_difference(b)
    exp = [x for x in dedup(a) if x not in set(b)] + [x for x in dedup(b) if x not in set(a)]
    assert list(r) == exp


@given(L, L)
def test_symdiff_update(a, b):
    s = OrderedSet(a)
    s.symmetric_difference_update(b)
    exp = [x for x in dedup(a) if x not in set(b)] + [x for x in dedup(b) if x not in set(a)]
    assert list(s) == exp
    assert s.map == {v: i for i, v in enumerate(s.items)}


@given(L, L, L)
def test_diff_union_inter(a, b, c):
    assert list(OrderedSet(a).difference(b, c)) == [x for x in dedup(a) if x not in set(b) | set(c)]
    s = OrderedSet(a)
    s.difference_update(b, c)
    assert list(s) == [x for x in dedup(a) if x not in set(b) | set(c)]
    assert list(OrderedSet(a).union(b, c)) == dedup(a + b + c)
    assert list(OrderedSet(a).intersection(b, c)) == [x for x in dedup(a) if x in set(b) & set(c)]


class M(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.s = OrderedSet()
        self.m = []

    @rule(x=st.integers(0, 5))
    def add(self, x):
        self.s.add(x)
        if x not in self.m:
            self.m.append(x)

    @rule(x=st.integers(0, 5))
    def discard(self, x):
        self.s.discard(x)
        if x in self.m:
            self.m.remove(x)

    @precondition(lambda self: self.m)
    @rule(i=st.integers(0, 5))
    def pop(self, i):
        i = i % len(self.m)
        assert self.s.pop(i) == self.m.pop(i)

    @rule()
    def clear(self):
        self.s.clear()
        self.m = []

    @invariant()
    def consistent(self):
        assert list(self.s) == self.m
        for i, v in enumerate(self.m):
            assert self.s.index(v) == i


TestM = M.TestCase
