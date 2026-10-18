from hypothesis import given, strategies as st
from furl.omdict1D import omdict1D
keys = st.one_of(st.integers(), st.text())
vals = st.one_of(st.integers(), st.text(), st.none())


@given(keys, st.lists(vals))
def test_add_list(k, vs):
    o = omdict1D()
    o.add(k, vs)
    assert o.getlist(k) == vs
    assert o.allitems() == [(k, v) for v in vs]
    assert (k in o) == bool(vs)


@given(keys, vals)
def test_add_scalar(k, v):
    o = omdict1D()
    o.add(k, v)
    assert o.getlist(k) == [v]


@given(keys, st.lists(vals), st.lists(vals))
def test_add_twice(k, a, b):
    o = omdict1D()
    o.add(k, a)
    o.add(k, b)
    assert o.getlist(k) == a + b
    assert list(o.allitems()) == [(k, v) for v in a + b]


@given(keys, st.lists(vals))
def test_add_tuple(k, vs):
    o = omdict1D()
    o.add(k, tuple(vs))
    assert o.getlist(k) == vs


@given(keys, st.lists(vals))
def test_add_returns_self_and_len(k, vs):
    o = omdict1D()
    r = o.add(k, vs)
    assert r is o and len(o) == (1 if vs else 0)
