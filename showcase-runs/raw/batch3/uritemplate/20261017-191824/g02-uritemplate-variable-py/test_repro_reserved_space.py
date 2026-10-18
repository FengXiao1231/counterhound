from uritemplate.variable import Operator


def test_repro_reserved_space():
    assert Operator.reserved.quote("a b%41") == "a%20b%41"
