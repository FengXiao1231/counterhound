from itertools import permutations, islice
from hypothesis import given, assume, strategies as st
from more_itertools.more import (chunked, derangements, split_before,
                                 split_after, split_when, split_into)

L = st.lists(st.integers(0, 5), max_size=12)


@given(L, st.integers(1, 6))
def test_chunked(xs, n):
    c = list(chunked(xs, n))
    assert [x for ch in c for x in ch] == xs
    assert all(len(ch) == n for ch in c[:-1])
    assert all(0 < len(ch) <= n for ch in c)


@given(L, st.integers(1, 6))
def test_chunked_strict(xs, n):
    if len(xs) % n:
        try:
            list(chunked(xs, n, strict=True))
        except ValueError:
            return
        assert False
    assert list(chunked(xs, n, strict=True)) == list(chunked(xs, n))


@given(st.lists(st.integers(0, 5), max_size=6), st.one_of(st.none(), st.integers(0, 7)))
def test_derangements(xs, r):
    got = list(derangements(xs, r))
    k = len(xs) if r is None else r
    exp = [tuple(xs[i] for i in p) for p in permutations(range(len(xs)), k)
           if all(p[j] != j for j in range(k))]
    assert got == exp


def ref_split(xs, pred, maxsplit, mode):
    out, buf, splits = [], [], 0
    for i, x in enumerate(xs):
        can = maxsplit < 0 or splits < maxsplit
        if mode == 'before':
            if pred(x) and buf and can:
                out.append(buf); buf = []; splits += 1
            buf.append(x)
        elif mode == 'after':
            buf.append(x)
            if pred(x) and can:
                out.append(buf); buf = []; splits += 1
        else:
            if buf and can and pred(buf[-1], x):
                out.append(buf); buf = []; splits += 1
            buf.append(x)
    if buf:
        out.append(buf)
    return out


@given(L, st.integers(-1, 6), st.integers(2, 3))
def test_split_before(xs, m, k):
    p = lambda x: x % k == 0
    assert list(split_before(xs, p, m)) == ref_split(xs, p, m, 'before')


@given(L, st.integers(-1, 6), st.integers(2, 3))
def test_split_after(xs, m, k):
    p = lambda x: x % k == 0
    assert list(split_after(xs, p, m)) == ref_split(xs, p, m, 'after')


@given(L, st.integers(-1, 6))
def test_split_when(xs, m):
    p = lambda a, b: a > b
    assert list(split_when(xs, p, m)) == ref_split(xs, p, m, 'when')


@given(L, st.lists(st.one_of(st.none(), st.integers(0, 5)), max_size=6))
def test_split_into(xs, sizes):
    exp, pos = [], 0
    for s in sizes:
        if s is None:
            exp.append(xs[pos:]); break
        exp.append(xs[pos:pos + s]); pos += s
    assert list(split_into(xs, sizes)) == exp
