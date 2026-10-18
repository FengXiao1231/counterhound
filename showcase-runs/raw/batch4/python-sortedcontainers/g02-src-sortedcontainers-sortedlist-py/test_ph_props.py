import bisect
from hypothesis import given, settings, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
from sortedcontainers.sortedlist import SortedList, SortedKeyList

ints = st.lists(st.integers(-20, 20), max_size=60)
loads = st.integers(4, 8)


def mk(vals, load):
    sl = SortedList(vals)
    sl._reset(load)
    return sl


def mkk(vals, load, key):
    sl = SortedKeyList(vals, key=key)
    sl._reset(load)
    return sl


@given(ints, loads, st.integers(-25, 25))
def test_sl_bisect(vals, load, v):
    sl = mk(vals, load)
    ref = sorted(vals)
    assert sl.bisect_left(v) == bisect.bisect_left(ref, v)
    assert sl.bisect_right(v) == bisect.bisect_right(ref, v)


@given(ints, loads, st.integers(-25, 25))
def test_skl_bisect(vals, load, v):
    key = lambda x: -x
    sl = mkk(vals, load, key)
    ref = sorted(vals, key=key)
    keys = [key(x) for x in ref]
    assert sl.bisect_left(v) == bisect.bisect_left(keys, key(v))
    assert sl.bisect_right(v) == bisect.bisect_right(keys, key(v))
    assert sl.bisect_key_left(key(v)) == bisect.bisect_left(keys, key(v))
    assert sl.bisect_key_right(key(v)) == bisect.bisect_right(keys, key(v))


@given(ints, ints, loads)
def test_skl_update(a, b, load):
    key = lambda x: x % 5
    sl = mkk(a, load, key)
    sl.update(b)
    sl._check()
    assert sorted(sl) == sorted(a + b)
    assert [key(x) for x in sl] == sorted(key(x) for x in a + b)
    assert len(sl) == len(a) + len(b)


class M(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.sl = SortedList(key=lambda x: x % 7)
        self.sl._reset(4)
        self.m = []

    @rule(v=st.integers(-20, 20))
    def add(self, v):
        self.sl.add(v)
        self.m.append(v)

    @rule(vs=st.lists(st.integers(-20, 20), max_size=30))
    def update(self, vs):
        self.sl.update(vs)
        self.m.extend(vs)

    @rule(v=st.integers(-20, 20))
    def discard(self, v):
        self.sl.discard(v)
        if v in self.m:
            self.m.remove(v)

    @rule()
    def clear(self):
        self.sl.clear()
        self.m = []

    @invariant()
    def ok(self):
        self.sl._check()
        assert sorted(self.sl) == sorted(self.m)
        assert [x % 7 for x in self.sl] == sorted(x % 7 for x in self.m)
        for v in {0, 3, 6}:
            ks = [x % 7 for x in self.sl]
            assert self.sl.bisect_key_left(v) == bisect.bisect_left(ks, v)
            assert self.sl.bisect_key_right(v) == bisect.bisect_right(ks, v)


TestM = M.TestCase
