from ordered_set import OrderedSet


def test_repro_symdiff_update_dups():
    s = OrderedSet()
    s.symmetric_difference_update([0, 0])
    assert list(s) == [0]
    assert list(OrderedSet().symmetric_difference([0, 0])) == [0]
