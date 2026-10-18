from toolz.functoolz import memoize


def test_repro_memoize_unary_kwarg():
    def f(a):
        return a + 1

    assert f(a=0) == 1
    assert memoize(f)(a=0) == 1
