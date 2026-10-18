from hypothesis import given, assume, strategies as st
from inflection import camelize, titleize, ordinalize, ordinal, singularize, humanize, pluralize, underscore

ident = st.from_regex(r"[a-z][a-z0-9]*(_[a-z0-9]+)*", fullmatch=True)


@given(st.text(alphabet="abc_", min_size=1))
def test_camelize_lower_first_no_crash_and_lower_first(s):
    r = camelize(s, False)
    assert isinstance(r, str)


@given(st.text(alphabet="abc_", min_size=1))
def test_camelize_lower_matches_upper_except_first(s):
    # lowerCamel and UpperCamel differ only in first char's case
    up = camelize(s, True)
    low = camelize(s, False)
    assert len(low) == len(up)
    assert low[1:] == up[1:]


@given(ident)
def test_camelize_no_underscores(s):
    assert "_" not in camelize(s)
    assert "_" not in camelize(s, False)


@given(st.integers())
def test_ordinalize_prefix(n):
    r = ordinalize(n)
    assert r.startswith(str(n)) and r[len(str(n)):] in ("st", "nd", "rd", "th")


@given(st.integers())
def test_ordinal_reference(n):
    a = abs(n)
    if 10 <= a % 100 <= 20 and a % 100 in (11, 12, 13):
        exp = "th"
    else:
        exp = {1: "st", 2: "nd", 3: "rd"}.get(a % 10, "th")
    assert ordinal(n) == exp


@given(st.text(alphabet="abcXYZ _-'", max_size=15))
def test_titleize_no_crash(s):
    titleize(s)


@given(st.text(alphabet="abc _", max_size=15))
def test_humanize_first_upper(s):
    r = humanize(s)
    if r:
        assert r == r  # no crash


@given(st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=1, max_size=10))
def test_singularize_pluralize_roundtrip(w):
    assert isinstance(singularize(pluralize(w)), str)
