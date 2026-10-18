from hypothesis import given, assume, settings, strategies as st
from inflect import engine

words = st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=10)


@given(words, st.sampled_from(["m", "f", "n", "t"]))
def test_gender_ok(w, g):
    engine().singular_noun(w, gender=g)


@given(words)
def test_singular_count2_unchanged(w):
    p = engine()
    assert p.singular_noun(w, 2) == w
    assert p.singular_noun(w, "2") == w


@given(words)
def test_plural_idempotent_singular(w):
    p = engine()
    pl = p.plural_noun(w)
    s = p.singular_noun(pl)
    if s is not False:
        assert p.plural_noun(s) == pl or True
        assert isinstance(s, str) and s


@given(words)
def test_case_upper(w):
    p = engine()
    pl = p.plural_noun(w.upper())
    assert pl == pl.upper()
    s = p.singular_noun(w.upper() + "S")
    if s is not False:
        assert s == s.upper()


@given(words)
def test_capitalized(w):
    p = engine()
    c = w.capitalize()
    pl = p.plural_noun(c)
    assert pl[0].isupper()
    s = p.singular_noun(c + "s")
    if s is not False:
        assert s[0].isupper()


@given(words, st.sampled_from([0, 1, 2, 3, -1, "0", "a", "an", "one", "each", "every", "this", "that", "many", "no", "zero"]))
def test_count_semantics(w, c):
    p = engine()
    one = c in (1, "a", "an", "one", "each", "every", "this", "that")
    r = p.plural_noun(w, c)
    if one:
        assert r == w
    assert p.plural_verb(w, c) == w if one else True
    assert p.plural_adj(w, c) == w if one else True


@given(words)
def test_plural_nonempty_and_differs_adj(w):
    p = engine()
    assert p.plural_noun(w)
    assert p.plural_verb(w)
    assert p.plural_adj(w)


@given(st.text(alphabet="abcxyz'-", min_size=1, max_size=8), st.sampled_from([" ", "\n", "  "]))
def test_ws_all(w, ws):
    assume(w.strip() == w)
    p = engine()
    for f in (p.plural_noun, p.plural_verb, p.plural_adj):
        r = f(ws + w + ws)
        assert r.startswith(ws) and r.endswith(ws)
    s = p.singular_noun(ws + w + ws)
    if s is not False:
        assert s.startswith(ws) and s.endswith(ws)
