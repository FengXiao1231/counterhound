from hypothesis import given, strategies as st
from toolz.functoolz import memoize, do, flip, pipe, complement, is_arity

ints = st.integers()


@given(ints)
def test_memoize_unary_kwarg(x):
    def f(a):
        return a + 1
    assert memoize(f)(a=x) == f(x)


@given(ints, ints)
def test_memoize_kw_vs_pos(x, y):
    def f(a, b=0):
        return a * 10 + b
    m = memoize(f)
    assert m(x, b=y) == f(x, b=y)
    assert m(x, y) == f(x, y)
    assert m(x) == f(x)


@given(ints, ints)
def test_memoize_calls_once(x, y):
    calls = []
    def f(a, b):
        calls.append(1)
        return a - b
    m = memoize(f)
    assert m(x, y) == m(x, y) == x - y
    assert len(calls) == 1


@given(ints)
def test_memoize_varargs(x):
    def f(*a, **k):
        return (a, sorted(k.items()))
    m = memoize(f)
    assert m() == f()
    assert m(x) == f(x)
    assert m(a=x) == f(a=x)
    assert m(x, a=x) == f(x, a=x)


@given(ints)
def test_do_pipe_flip_complement(x):
    log = []
    assert do(log.append, x) == x and log == [x]
    assert pipe(x, lambda v: v + 1, str) == str(x + 1)
    assert pipe(x) == x
    assert flip(lambda a, b: (a, b), x, 3) == (3, x)
    even = lambda n: n % 2 == 0
    assert complement(even)(x) == (not even(x))


def test_arity():
    assert is_arity(1, lambda x: x)
    assert is_arity(0, lambda: 1)
    assert not is_arity(1, lambda x, y=1: x)
    assert not is_arity(1, lambda *a: a)
    assert is_arity(2, lambda x, y: x)
