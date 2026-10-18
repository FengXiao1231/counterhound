from inflect import engine


def test_narrow():
    res = []
    for t in ("x of a a", "x of b b", "x of c d", "man of war war", "x of y z w", "x of A A"):
        p = engine()
        try:
            res.append(repr(p._plnoun(t)))
        except Exception as e:
            res.append("ERR")
    assert False, "|".join(res)
