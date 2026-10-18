from num2words.lang_BN import Num2Word_BN


def test_repro_decimal_leading_zero():
    # 1.05 and 1.5 must not read the same
    n = Num2Word_BN()
    assert n.to_cardinal('1.05') != n.to_cardinal('1.5')
