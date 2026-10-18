from hypothesis import given, assume, settings, strategies as st
from boltons.statsutils import Stats
nums = st.lists(st.integers(-1000, 1000), min_size=1, max_size=40)

@given(nums, st.one_of(st.none(), st.integers(1, 12)))
def test_hist_sum(d, b):
    s = Stats(d)
    assert sum(c for _, c in s.get_histogram_counts(b)) == len(d)

@given(nums, st.lists(st.integers(-1000, 1000), min_size=1, max_size=6))
def test_hist_sum_list(d, b):
    s = Stats(d)
    assert sum(c for _, c in s.get_histogram_counts(b)) == len(d)

@given(nums, st.one_of(st.none(), st.integers(1, 12)))
def test_format(d, b):
    out = Stats(d).format_histogram(b, width=40)
    assert out

@given(nums, st.floats(0, 0.4999))
def test_trim(d, a):
    s = Stats(d); n = len(d); k = int(n * a)
    s.trim_relative(a)
    assert sorted(d)[k:n-k] == sorted(s.data)

@given(nums, st.floats(0, 1))
def test_quant(d, q):
    s = Stats(d)
    v = s.get_quantile(q)
    assert min(d) <= v <= max(d)

@given(nums)
def test_describe(d):
    r = Stats(d).describe()
    assert r['min'] <= r['0.25'] <= r['0.5'] <= r['0.75'] <= r['max']

def test_empty():
    Stats([]).format_histogram()
