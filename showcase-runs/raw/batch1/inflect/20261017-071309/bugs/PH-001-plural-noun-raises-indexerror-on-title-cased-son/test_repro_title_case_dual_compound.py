import inflect


def test_repro_title_case_dual_compound():
    p = inflect.engine()
    assert p.plural_noun("son of a gun") == "sons of guns"
    # Capitalised version of the same phrase must not crash
    assert p.plural_noun("Son Of A Gun") == "Sons Of Guns"
