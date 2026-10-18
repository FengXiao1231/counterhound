from hypothesis import given, strategies as st
from cachetools import FIFOCache, LFUCache, TTLCache, TLRUCache

ops = st.lists(st.tuples(st.sampled_from("sg"), st.integers(0, 4)), max_size=30)


@given(ops)
def test_fifo_and_ttl_order(ops):
    f = FIFOCache(3)
    t = TTLCache(3, 1000, timer=lambda: 0)
    l = TLRUCache(3, lambda k, v, n: n + 1000, timer=lambda: 0)
    ref_f, ref_l = [], []
    for op, k in ops:
        if op == "s":
            f[k] = k
            t[k] = k
            l[k] = k
            if k not in ref_f:
                if len(ref_f) == 3:
                    ref_f.pop(0)
                ref_f.append(k)
            if k in ref_l:
                ref_l.remove(k)
            elif len(ref_l) == 3:
                ref_l.pop(0)
            ref_l.append(k)
        else:
            if k in t:
                t[k]
            if k in l:
                l[k]
            if k in ref_l:
                ref_l.remove(k)
                ref_l.append(k)
    assert list(f) == ref_f
    assert list(t) == ref_l or sorted(t) == sorted(ref_l)
    assert sorted(l) == sorted(ref_l)
    if ref_f:
        assert f.popitem()[0] == ref_f[0]
        assert t.popitem()[0] == ref_l[0]
        assert l.popitem()[0] == ref_l[0]


@given(st.lists(st.integers(0, 4), max_size=30))
def test_lfu_popitem_min(seq):
    c = LFUCache(10)
    cnt = {}
    for k in seq:
        if k in c:
            c[k]
            cnt[k] += 1
        else:
            c[k] = k
            cnt[k] = 1
    if cnt:
        k, _ = c.popitem()
        assert cnt[k] == min(cnt.values())
