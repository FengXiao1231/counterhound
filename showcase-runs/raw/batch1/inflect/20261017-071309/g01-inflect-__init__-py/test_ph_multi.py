from hypothesis import given, assume, settings, strategies as st
from inflect import engine

w = st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=6)
sep = st.sampled_from([" ", "  ", "-", " of ", " and ", " to ", "'s ", " a ", " the "])


@st.composite
def phrases(draw):
    n = draw(st.integers(1, 4))
    out = draw(w)
    for _ in range(n - 1):
        out += draw(sep) + draw(w)
    return out


@given(phrases(), st.sampled_from(["", "I", "A", "Xy"]))
def test_multiword_noun(t, extra):
    p = engine()
    for f in (p.plural_noun, p.plural_verb, p.plural_adj, p.singular_noun):
        f(t)
        f(t.title())
        f(t.upper())


@given(phrases())
def test_multiword_upper_classical(t):
    p = engine()
    p.classical(all=True)
    for f in (p.plural_noun, p.plural_verb, p.plural_adj, p.singular_noun):
        f(t)
        f(t.title())


@given(phrases())
def test_gender(t):
    p = engine()
    for g in ("masculine", "feminine", "neuter", "gender-neutral", "feminine or masculine"):
        p.singular_noun(t, gender=g)
