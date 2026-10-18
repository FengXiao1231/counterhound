from hypothesis import given, assume, settings, strategies as st
from boltons.iterutils import split_iter, chunked, chunked_iter, windowed, windowed_iter, partition, unique_iter

L = st.lists(st.integers(0, 4), max_size=20)

@given(L, st.integers(0, 4), st.one_of(st.none(), st.integers(0, 6)))
def test_split_ref(src, sep, ms):
    ref = []; cur = []; n = 0
    for x in src:
        if x == sep and (ms is None or n < ms):
            ref.append(cur); cur = []; n += 1
        else:
            cur.append(x)
    ref.append(cur)
    assert list(split_iter(src, sep, ms)) == ref

@given(L, st.sets(st.integers(0, 4)))
def test_split_set_no_sep_and_rejoin(src, seps):
    out = list(split_iter(src, seps))
    assert all(not (set(g) & seps) for g in out)
    assert [x for g in out for x in g] == [x for x in src if x not in seps]

@given(L, st.integers(1, 6), st.one_of(st.none(), st.integers(0, 5)))
def test_chunked(src, size, count):
    out = chunked(src, size, count)
    full = [src[i:i+size] for i in range(0, len(src), size)]
    assert out == (full if count is None else full[:count])

@given(L, st.integers(1, 6))
def test_chunked_fill(src, size):
    out = chunked(src, size, fill=-1)
    assert all(len(c) == size for c in out)
    assert [x for c in out for x in c if x != -1] == [x for x in src]

@given(st.text(max_size=20), st.integers(1, 6))
def test_chunked_str(src, size):
    assert chunked(src, size) == [src[i:i+size] for i in range(0, len(src), size)]

@given(L, st.integers(1, 6))
def test_chunked_gen(src, size):
    assert chunked(iter(src), size) == chunked(src, size)

@given(L, st.integers(1, 6))
def test_windowed(src, size):
    exp = [tuple(src[i:i+size]) for i in range(len(src)-size+1)]
    assert windowed(src, size) == exp
    assert windowed(iter(src), size) == exp

@given(L, st.integers(1, 6))
def test_windowed_fill(src, size):
    exp = [tuple((src + [None]*size)[i:i+size]) for i in range(len(src))]
    assert windowed(src, size, fill=None) == exp
    assert windowed(iter(src), size, fill=None) == exp

@given(L, st.integers(0, 3), st.integers(0, 3))
def test_partition(src, a, b):
    p = partition(src, lambda x: x == a, lambda x: x == b)
    assert len(p) == 3
    assert p[0] == [x for x in src if x == a]
    assert p[1] == [x for x in src if x == b and x != a]
    assert p[2] == [x for x in src if x not in (a, b)]

@given(L)
def test_partition_default(src):
    t, f = partition(src)
    assert t == [x for x in src if x] and f == [x for x in src if not x]

@given(L, st.integers(1, 4))
def test_unique(src, m):
    out = list(unique_iter(src, key=lambda x: x % m))
    seen = []; ref = []
    for x in src:
        if x % m not in seen:
            seen.append(x % m); ref.append(x)
    assert out == ref
