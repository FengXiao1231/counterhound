from ordered_set import OrderedSet


def test_repro_pop_stale_index():
    s = OrderedSet([0, 1])
    assert s.pop(0) == 0
    assert list(s) == [1]
    assert s.index(1) == 0
