from hypothesis import given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
from cachetools import Cache, FIFOCache, LFUCache, TTLCache, TLRUCache

keys = st.integers(0, 5)
vals = st.integers(0, 4)


class Clock:
    def __init__(self):
        self.t = 0

    def __call__(self):
        return self.t


def make(kind, clock):
    gs = lambda v: v
    if kind == "fifo":
        return FIFOCache(6, getsizeof=gs)
    if kind == "lfu":
        return LFUCache(6, getsizeof=gs)
    if kind == "ttl":
        return TTLCache(6, 3, timer=clock, getsizeof=gs)
    if kind == "tlru":
        return TLRUCache(6, lambda k, v, now: now + (k % 4) - 0, timer=clock, getsizeof=gs)
    return Cache(6, getsizeof=gs)


class M(RuleBasedStateMachine):
    kind = "cache"

    def __init__(self):
        super().__init__()
        self.clock = Clock()
        self.c = make(self.kind, self.clock)

    @rule(k=keys, v=vals)
    def put(self, k, v):
        self.c[k] = v

    @rule(k=keys)
    def pop(self, k):
        self.c.pop(k, None)

    @rule(k=keys, v=vals)
    def setdefault(self, k, v):
        self.c.setdefault(k, v)

    @rule(k=keys)
    def get(self, k):
        self.c.get(k)

    @rule(d=st.integers(0, 3))
    def tick(self, d):
        self.clock.t += d

    @rule()
    def expire(self):
        if hasattr(self.c, "expire"):
            exp = self.c.expire()
            for k, v in exp:
                assert k not in self.c

    @rule()
    def popitem(self):
        if len(self.c) == 0:
            return
        before = dict(self.c.items())
        k, v = self.c.popitem()
        assert before[k] == v and k not in self.c

    @rule()
    def clear(self):
        self.c.clear()
        assert len(self.c) == 0 and self.c.currsize == 0

    @invariant()
    def consistent(self):
        c = self.c
        items = dict(c.items())
        assert len(c) == len(items) == len(list(c))
        assert c.currsize == sum(items.values())
        assert c.currsize <= c.maxsize
        for k in items:
            assert k in c


def mk(kind):
    cls = type("M_" + kind, (M,), {"kind": kind})
    return cls.TestCase


TestCacheM = mk("cache")
TestFifoM = mk("fifo")
TestLfuM = mk("lfu")
TestTtlM = mk("ttl")
TestTlruM = mk("tlru")
