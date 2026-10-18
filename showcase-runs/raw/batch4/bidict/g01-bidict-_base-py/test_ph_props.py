from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
from bidict import bidict, OrderedBidict, frozenbidict, ON_DUP_DROP_OLD
from bidict._base import BidictBase

K = st.integers(-5, 5)
items = st.lists(st.tuples(K, K), max_size=8)
CLASSES = st.sampled_from([bidict, OrderedBidict, frozenbidict])


def build(cls, its):
    return cls(dict(its)) if False else cls(_dedup(its))


def _dedup(its):
    d, seen = {}, set()
    for k, v in its:
        if k in d or v in seen:
            continue
        d[k] = v
        seen.add(v)
    return d


@given(CLASSES, items)
def test_views(cls, its):
    b = cls(_dedup(its))
    d = dict(b)
    assert list(b.keys()) == list(d.keys())
    assert list(b.values()) == list(d.values())
    assert list(b.items()) == list(d.items())
    assert list(zip(b.keys(), b.values())) == list(b.items())
    assert set(b.values()) == set(b.inverse.keys())
    assert list(reversed(b.items())) == list(reversed(list(d.items()))) if hasattr(b.items(), '__reversed__') else True
    assert (b.keys() | {99}) == (set(d) | {99})
    assert (b.values() & {1, 2}) == (set(d.values()) & {1, 2})
    assert b.items() == d.items()


@given(CLASSES, items)
def test_copy(cls, its):
    b = cls(_dedup(its))
    c = b.copy()
    assert c == b and type(c) is type(b) and c is not b
    assert list(c.items()) == list(b.items())
    assert c.equals_order_sensitive(b)
    assert dict(c.inverse) == dict(b.inverse)
    assert list(c.inverse.items()) == list(b.inverse.items())
    if hasattr(c, 'put'):
        c.put(100, 100)
        assert 100 not in b and 100 not in b.inverse


@given(items, items)
def test_order_sensitive(a, b):
    x, y = OrderedBidict(_dedup(a)), OrderedBidict(_dedup(b))
    assert x.equals_order_sensitive(y) == (list(x.items()) == list(y.items()))
    assert x.equals_order_sensitive(dict(y)) == (list(x.items()) == list(dict(y).items()))
    assert x.equals_order_sensitive(y) == y.equals_order_sensitive(x)
    assert not x.equals_order_sensitive([1])


class M(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.b = OrderedBidict()
        self.m = {}

    @rule(k=K, v=K)
    def forceput(self, k, v):
        self.b.forceput(k, v)
        self.m.pop(k, None)
        for kk in [kk for kk, vv in self.m.items() if vv == v]:
            del self.m[kk]
        self.m[k] = v

    @rule(k=K)
    def pop(self, k):
        if k in self.m:
            assert self.b.pop(k) == self.m.pop(k)

    @rule(its=items)
    def update(self, its):
        self.b.putall(its, ON_DUP_DROP_OLD)
        for k, v in its:
            self.m.pop(k, None)
            for kk in [kk for kk, vv in self.m.items() if vv == v]:
                del self.m[kk]
            self.m[k] = v

    @rule()
    def replace_copy(self):
        self.b = self.b.copy()

    @invariant()
    def check(self):
        b = self.b
        assert dict(b.items()) == self.m
        assert list(b.keys()) == [k for k, _ in b.items()]
        assert list(b.values()) == [v for _, v in b.items()]
        assert list(b.inverse.values()) == list(b.keys())
        assert dict(b.inverse) == {v: k for k, v in self.m.items()}
        assert b.copy().equals_order_sensitive(b)


TestM = M.TestCase
