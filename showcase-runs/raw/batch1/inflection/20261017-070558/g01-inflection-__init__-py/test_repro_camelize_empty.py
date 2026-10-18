from inflection import camelize


def test_repro_camelize_empty():
    assert camelize("", True) == ""
    assert camelize("", False) == ""
