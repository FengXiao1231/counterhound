from hypothesis import given, assume, strategies as st
from toolz.itertoolz import (groupby, partition, sliding_window,
                             partition_all, topk, unique)

ints = st.lists(st.integers(-20, 20), max_size=40)
anyl = st.lists(st.one_of(st.integers(), st.text(max_size=3), st.none()), max_size=30)
ns = st.integers(1, 8)


@given(ints)
def test_groupby_ref(xs):
    r = groupby(lambda x: x % 3, xs)
    ref = {}
    for x in xs:
        ref.setdefault(x % 3, []).append(x)
    assert r == ref
    assert list(r) == list(ref)


@given(st.lists(st.dictionaries(st.sampled_from("ab"), st.integers(), min_size=2)))
def test_groupby_member(ds):
    r = groupby("a", ds)
    assert sum(map(len, r.values())) == len(ds)


@given(ns, anyl, st.booleans())
def test_partition(n, xs, as_iter):
    seq = iter(xs) if as_iter else xs
    r = list(partition(n, seq))
    assert r == [tuple(xs[i:i + n]) for i in range(0, len(xs) - n + 1, n)]


@given(ns, anyl, st.booleans())
def test_partition_pad(n, xs, as_iter):
    seq = iter(xs) if as_iter else xs
    r = list(partition(n, seq, pad="P"))
    ref = [tuple(xs[i:i + n]) for i in range(0, len(xs), n)]
    if ref and len(ref[-1]) < n:
        ref[-1] = ref[-1] + ("P",) * (n - len(ref[-1]))
    assert r == ref


@given(ns, anyl, st.booleans())
def test_partition_all(n, xs, as_iter):
    seq = iter(xs) if as_iter else xs
    r = list(partition_all(n, seq))
    assert r == [tuple(xs[i:i + n]) for i in range(0, len(xs), n)]


@given(ns, st.text(max_size=30))
def test_partition_all_str_and_range(n, s):
    assert list(partition_all(n, s)) == [tuple(s[i:i + n]) for i in range(0, len(s), n)]
    assert list(partition_all(n, range(len(s)))) == [tuple(range(i, min(i + n, len(s)))) for i in range(0, len(s), n)]


@given(ns, anyl, st.booleans())
def test_sliding_window(n, xs, as_iter):
    seq = iter(xs) if as_iter else xs
    r = list(sliding_window(n, seq))
    assert r == [tuple(xs[i:i + n]) for i in range(0, len(xs) - n + 1)]


@given(st.integers(0, 10), ints, st.booleans())
def test_topk(k, xs, usekey):
    key = (lambda x: -abs(x)) if usekey else None
    r = topk(k, xs, key=key)
    ref = tuple(sorted(xs, key=key, reverse=True)[:k])
    assert r == ref


@given(anyl)
def test_unique(xs):
    r = list(unique(xs))
    ref = []
    for x in xs:
        if x not in ref:
            ref.append(x)
    assert r == ref


@given(ints)
def test_unique_key(xs):
    r = list(unique(xs, key=lambda x: x % 4))
    ref, seen = [], set()
    for x in xs:
        if x % 4 not in seen:
            seen.add(x % 4)
            ref.append(x)
    assert r == ref
    assert list(unique(iter(xs))) == list(unique(xs))
