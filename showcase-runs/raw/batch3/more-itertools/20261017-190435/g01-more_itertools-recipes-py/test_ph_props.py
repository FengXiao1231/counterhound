from fractions import Fraction
from math import gcd
import statistics
from hypothesis import given, assume, settings, strategies as st
from more_itertools.recipes import (partition, unique_everseen, unique,
                                    totient, running_median, running_mean)

ints = st.lists(st.integers(-20, 20), max_size=30)


@given(ints, st.integers(1, 5))
def test_partition_split(xs, m):
    pred = lambda x: x % m == 0
    f, t = partition(pred, xs)
    assert list(f) == [x for x in xs if not pred(x)]
    assert list(t) == [x for x in xs if pred(x)]


@given(ints, st.integers(1, 5), st.lists(st.booleans(), max_size=60))
def test_partition_interleaved(xs, m, order):
    pred = lambda x: x % m == 0
    f, t = partition(pred, xs)
    rf, rt = [], []
    its = (f, t)
    for o in order:
        try:
            (rt if o else rf).append(next(its[o]))
        except StopIteration:
            pass
    rf += list(f)
    rt += list(t)
    assert rf == [x for x in xs if not pred(x)]
    assert rt == [x for x in xs if pred(x)]


@given(st.lists(st.one_of(st.integers(), st.booleans(), st.none(), st.text(max_size=2))))
def test_partition_none(xs):
    f, t = partition(None, xs)
    assert list(f) == [x for x in xs if not x]
    assert list(t) == [x for x in xs if x]


@given(st.lists(st.text(max_size=3), max_size=30))
def test_unique_everseen(xs):
    ref = list(dict.fromkeys(xs))
    assert list(unique_everseen(xs)) == ref
    key = str.casefold
    seen, r = set(), []
    for x in xs:
        if key(x) not in seen:
            seen.add(key(x)); r.append(x)
    assert list(unique_everseen(xs, key)) == r


@given(ints, st.booleans(), st.booleans())
def test_unique(xs, rev, usekey):
    key = (lambda x: x % 5) if usekey else None
    out = list(unique(xs, key=key, reverse=rev))
    ref_sorted = sorted(xs, key=key, reverse=rev)
    k = key or (lambda x: x)
    ref = []
    for x in ref_sorted:
        if not ref or k(ref[-1]) != k(x):
            ref.append(x)
    assert out == ref
    assert len(set(map(k, out))) == len(out)


@given(st.lists(st.lists(st.integers(0, 3), max_size=3), max_size=10))
def test_unique_unhashable(xs):
    out = list(unique(xs))
    assert out == sorted(set(map(tuple, xs)), key=None) or True
    assert out == [list(t) for t in sorted(set(map(tuple, xs)))]


@given(st.integers(1, 5000))
def test_totient(n):
    assert totient(n) == sum(1 for k in range(1, n + 1) if gcd(n, k) == 1)


@given(st.integers(1, 10**12))
def test_totient_big(n):
    t = totient(n)
    assert isinstance(t, int) and 1 <= t <= n


@given(st.lists(st.integers(-100, 100), max_size=30),
       st.one_of(st.none(), st.integers(1, 8)))
def test_running_median(xs, w):
    out = list(running_median(xs, maxlen=w))
    ref = [statistics.median(xs[max(0, i + 1 - w) if w else 0:i + 1])
           for i in range(len(xs))]
    assert out == ref


@given(st.lists(st.fractions(max_denominator=10), max_size=30),
       st.one_of(st.none(), st.integers(1, 8)))
def test_running_mean(xs, w):
    out = list(running_mean(xs, maxlen=w))
    ref = [sum(xs[max(0, i + 1 - w) if w else 0:i + 1]) / len(xs[max(0, i + 1 - w) if w else 0:i + 1])
           for i in range(len(xs))]
    assert out == ref
