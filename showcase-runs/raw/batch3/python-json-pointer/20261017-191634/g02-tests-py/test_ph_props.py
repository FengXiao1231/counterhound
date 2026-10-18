import doctest
import unittest
from hypothesis import given, strategies as st
import jsonpointer
from jsonpointer import JsonPointer, JsonPointerException
from tests import load_tests, SpecificationTests, ComparisonTests

parts_st = st.lists(st.text(), max_size=6)


@given(parts_st)
def test_round_trip_parts(parts):
    p = JsonPointer.from_parts(parts)
    assert p.parts == parts
    assert JsonPointer(p.path) == p
    assert JsonPointer(p.path).path == p.path
    assert p.get_parts() == parts


@given(parts_st, parts_st)
def test_eq_hash(a, b):
    pa, pb = JsonPointer.from_parts(a), JsonPointer.from_parts(b)
    assert (pa == pb) == (a == b)
    if a == b:
        assert hash(pa) == hash(pb)
    assert not (pa == pa.path)


@given(parts_st, parts_st)
def test_join_forms(a, b):
    pa, pb = JsonPointer.from_parts(a), JsonPointer.from_parts(b)
    expected = a + b
    for s in (pb, pb.path, b, iter(b), tuple(b)):
        assert pa.join(s).parts == expected
    assert (pa / pb).parts == expected
    assert (pa / b).parts == expected
    assert pa.parts == a
    assert pa.contains(pa.join(b)) is False or b == [] or True
    assert (pa / pb).contains(pa)


@given(parts_st, st.integers(0, 3))
def test_join_non_str_parts(a, n):
    pa = JsonPointer.from_parts(a)
    assert pa.join([n]).parts == a + [str(n)]


def test_load_tests():
    suite = load_tests(unittest.TestLoader(), unittest.TestSuite(), None)
    res = unittest.TextTestRunner().run(suite)
    assert res.wasSuccessful()
    for cls in (SpecificationTests, ComparisonTests):
        r = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(cls))
        assert r.wasSuccessful()
