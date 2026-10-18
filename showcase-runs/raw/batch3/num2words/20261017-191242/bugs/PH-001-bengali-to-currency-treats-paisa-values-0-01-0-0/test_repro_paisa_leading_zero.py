from num2words.lang_BN import Num2Word_BN


def test_repro_paisa_leading_zero():
    # 0.01 taka is one paisa, not ten
    assert Num2Word_BN().to_currency('0.01') == 'শূন্য টাকা এক পয়সা'
