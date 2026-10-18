from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
from bidict import bidict, OrderedBidict, OnDup, DROP_OLD, DROP_NEW, RAISE, BidictException

K = st.integers(0, 4)
items = st.lists(st.tuples(K, K), max_size=6)
ondups = st.builds(OnDup, key=st.sampled_from([RAISE, DROP_OLD, DROP_NEW]), val=st.sampled_from([RAISE, DROP_OLD, DROP_NEW]))


def check(b):
    assert dict(b.inverse) == {v: k for k, v in b.items()}
    assert len(b.inverse) == len(b)
    assert len(set(b.values())) == len(b)


@given(items, st.sampled_from([bidict, OrderedBidict]))
def test_forceupdate_last_wins(its, cls):
    b = cls()
    b.forceupdate(its)
    check(b)
    m = {}
    for k, v in its:
        m = {a: c for a, c in m.items() if a != k and c != v}
        m[k] = v
    assert dict(b) == m


@given(items, items, ondups, st.sampled_from([bidict, OrderedBidict]))
def test_putall_atomic(base, its, od, cls):
    b = cls()
    b.forceupdate(base)
    before = list(b.items())
    try:
        b.putall(its, od)
    except BidictException:
        assert list(b.items()) == before
    check(b)


class M(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.b = OrderedBidict()
        self.c = bidict()

    @rule(k=K, v=K, od=ondups)
    def put(self, k, v, od):
        for x in (self.b, self.c):
            before = list(x.items())
            try:
                x.put(k, v, od)
            except BidictException:
                assert list(x.items()) == before
        assert dict(self.b) == dict(self.c)

    @rule(k=K, v=K)
    def force(self, k, v):
        self.b.forceput(k, v)
        self.c.forceput(k, v)

    @rule(its=items)
    def fu(self, its):
        self.b.forceupdate(its)
        self.c.forceupdate(its)

    @rule(k=K)
    def pop(self, k):
        assert self.b.pop(k, 'x') == self.c.pop(k, 'x')

    @rule()
    def popitem(self):
        if self.c:
            k, v = self.b.popitem()
            assert k not in self.b and v not in self.b.inverse
            self.c.pop(k)
        else:
            try:
                self.b.popitem()
                assert False
            except KeyError:
                pass

    @rule()
    def clear(self):
        self.b.clear()
        self.c.clear()

    @invariant()
    def inv(self):
        check(self.b)
        check(self.c)
        assert dict(self.b) == dict(self.c)


TestM = M.TestCase
