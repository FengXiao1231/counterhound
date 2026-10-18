from hypothesis import given, settings, strategies as st
from cachetools.func import fifo_cache, lfu_cache, lru_cache, rr_cache, ttl_cache

DECOS = [fifo_cache, lfu_cache, lru_cache, rr_cache, ttl_cache]
keys = st.lists(st.integers(-3, 6), max_size=40)
sizes = st.one_of(st.none(), st.integers(0, 6))


@given(st.sampled_from(DECOS), sizes, st.booleans(), keys)
def test_results_correct_and_info(deco, maxsize, typed, calls):
    n = []

    def f(x):
        n.append(x)
        return x * 2

    g = deco(maxsize, typed=typed)(f)
    for c in calls:
        assert g(c) == c * 2
    info = g.cache_info()
    assert info.hits + info.misses == len(calls)
    assert info.misses == len(n)
    assert info.maxsize == maxsize
    if maxsize is not None:
        assert info.currsize <= maxsize
    assert g.cache_parameters() == {"maxsize": maxsize, "typed": typed}
    g.cache_clear()
    i = g.cache_info()
    assert (i.hits, i.misses, i.currsize) == (0, 0, 0)


@given(st.sampled_from(DECOS), st.integers(1, 6), keys)
def test_lastcall_hit_when_fits(deco, maxsize, calls):
    n = []
    g = deco(maxsize)(lambda x: n.append(x) or x)
    for c in calls:
        g(c)
        k = len(n)
        g(c)
        assert len(n) == k


@given(st.integers(1, 5), keys)
def test_lru_model(maxsize, calls):
    from collections import OrderedDict

    m = OrderedDict()
    misses = 0
    g = lru_cache(maxsize)(lambda x: x)
    for c in calls:
        if c in m:
            m.move_to_end(c)
        else:
            misses += 1
            m[c] = 1
            if len(m) > maxsize:
                m.popitem(last=False)
        g(c)
    assert g.cache_info().misses == misses


@given(st.integers(1, 5), keys)
def test_fifo_model(maxsize, calls):
    m = []
    misses = 0
    g = fifo_cache(maxsize)(lambda x: x)
    for c in calls:
        if c not in m:
            misses += 1
            m.append(c)
            if len(m) > maxsize:
                m.pop(0)
        g(c)
    assert g.cache_info().misses == misses


@given(st.booleans(), st.sampled_from(DECOS))
def test_typed(typed, deco):
    g = deco(8, typed=typed)(lambda x: x)
    g(1)
    g(1.0)
    assert g.cache_info().misses == (2 if typed else 1)


@given(st.sampled_from(DECOS), keys)
def test_bare_decorator(deco, calls):
    g = deco(lambda x: x)
    for c in calls:
        g(c)
    assert g.cache_info().maxsize == 128
    assert g.__wrapped__(3) == 3


@given(st.integers(1, 5), st.lists(st.tuples(st.integers(0, 4), st.integers(0, 6)), max_size=30), sizes)
def test_ttl(ttl, steps, maxsize):
    t = [0]
    n = []
    g = ttl_cache(maxsize, ttl=ttl, timer=lambda: t[0])(lambda x: n.append(x) or x)
    last = {}
    for k, dt in steps:
        t[0] += dt
        before = len(n)
        g(k)
        expired = k not in last or t[0] >= last[k] + ttl
        if maxsize is None:
            assert (len(n) > before) == expired
        if len(n) > before:
            last[k] = t[0]


@given(st.integers(1, 5), keys)
def test_rr_choice(maxsize, calls):
    g = rr_cache(maxsize, choice=lambda s: s[0])(lambda x: x)
    for c in calls:
        assert g(c) == c
    assert g.cache_info().currsize <= maxsize
