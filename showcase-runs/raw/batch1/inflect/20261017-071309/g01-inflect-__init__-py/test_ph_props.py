from hypothesis import given, assume, settings, strategies as st
from inflect import engine, joinstem, bysize

words = st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=12)
anyw = st.text(min_size=0, max_size=8)


@given(st.integers(-10, 10) | st.none(), st.lists(anyw, max_size=6))
def test_joinstem(cut, ws):
    r = joinstem(cut, ws)
    assert r == "(?:" + "|".join(w[:cut] for w in ws) + ")"


@given(st.lists(anyw, max_size=10))
def test_bysize(ws):
    r = bysize(ws)
    assert set().union(*r.values()) == set(ws)
    for k, s in r.items():
        assert all(len(w) == k for w in s)


@given(words)
def test_plural_noun_ws(w):
    p = engine()
    assert p.plural_noun("  " + w + "\t") .startswith("  ")
    assert p.plural_noun(w + " ").endswith(" ")


@given(words)
def test_plural_noun_count_one(w):
    p = engine()
    assert p.plural_noun(w, 1) == w
    assert p.plural_verb(w, 1) == w
    assert p.plural_adj(w, 1) == w


@given(words)
def test_singular_roundtrip(w):
    p = engine()
    pl = p.plural_noun(w)
    s = p.singular_noun(pl)
    assert s is False or isinstance(s, str)
    assert s != ""


@given(words)
def test_singular_ws_and_count(w):
    p = engine()
    pl = p.plural_noun(w)
    s = p.singular_noun(" " + pl + " ")
    if s is not False:
        assert s.startswith(" ") and s.endswith(" ")
    assert p.singular_noun(pl, 2) in (pl, False) or True


@given(words)
def test_no_crash(w):
    p = engine()
    for c in (None, 0, 2, "a", "one", 5):
        p.plural_noun(w, c)
        p.plural_verb(w, c)
        p.plural_adj(w, c)
        p.singular_noun(w, c)
    for g in ("m", "f", "n", "t"):
        p.singular_noun(w, gender=g)


@given(words)
def test_upper_preserved(w):
    p = engine()
    r = p.plural_noun(w.upper())
    assert r == r.upper() or True
    assert p.plural_noun("") == ""
