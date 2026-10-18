import sys, types
if "humanize._version" not in sys.modules:
    _m = types.ModuleType("humanize._version")
    _m.__version__ = "0"
    sys.modules["humanize._version"] = _m
from fractions import Fraction
from hypothesis import given, assume, settings, strategies as st
from humanize.number import ordinal, clamp, intcomma, intword, apnumber, fractional


def ref_suffix(n):
    a = abs(n)
    if a % 100 in (11, 12, 13):
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(a % 10, "th")


@given(st.integers())
def test_ordinal_matches_reference(n):
    assert ordinal(n) == f"{n}{ref_suffix(n)}"


@given(st.integers(min_value=0))
def test_ordinal_nonneg(n):
    assert ordinal(n) == f"{n}{ref_suffix(n)}"


@given(st.integers(), st.sampled_from(["male", "female"]))
def test_ordinal_gender_same_english(n, g):
    assert ordinal(n, g) == ordinal(n)


@given(st.integers())
def test_intcomma_roundtrip(n):
    s = intcomma(n)
    assert int(s.replace(",", "")) == n
    assert intcomma(str(n)) == s
    body = s.lstrip("-").split(",")
    assert all(len(g) == 3 for g in body[1:]) and 1 <= len(body[0]) <= 3


@given(st.integers(-10**12, 10**12), st.integers(0, 6))
def test_intcomma_ndigits(n, d):
    s = intcomma(n, d)
    assert s == f"{n:,.{d}f}"


@given(st.floats(-1e12, 1e12), st.integers(0, 6))
def test_intcomma_float(x, d):
    assert intcomma(x, d) == f"{x:,.{d}f}"
    assert float(intcomma(x).replace(",", "")) == x


@given(st.integers())
def test_intword_sign_symmetry(n):
    r = intword(n)
    if n < 0:
        assert r == "-" + intword(-n)


@given(st.integers(0, 10**100))
def test_intword_value_close(n):
    r = intword(n)
    if n < 1000:
        assert r == str(n)
        return
    num, unit = r.split(" ")
    names = ["thousand", "million", "billion", "trillion", "quadrillion", "quintillion",
             "sextillion", "septillion", "octillion", "nonillion", "decillion", "googol"]
    p = 10 ** ([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 100][names.index(unit)])
    v = float(num) * p
    assert abs(v - n) <= 0.05 * p * 1.0000001 + 1
    if unit != "googol" and unit != "decillion":
        assert float(num) < 1000


@given(st.integers(-1000, 1000))
def test_apnumber(n):
    r = apnumber(n)
    if 0 <= n < 10:
        assert r == "zero one two three four five six seven eight nine".split()[n]
    else:
        assert r == str(n)


@given(st.integers(-1000, 1000), st.integers(1, 1000))
def test_fractional_exact(a, b):
    f = Fraction(a, b)
    assume(f.denominator <= 1000)
    r = fractional(float(f))
    w = int(f)
    rem = f - w
    if rem == 0:
        exp = str(w)
    elif w == 0:
        exp = f"{'-' if rem < 0 else ''}{abs(rem.numerator)}/{rem.denominator}"
    else:
        exp = f"{w} {abs(rem.numerator)}/{rem.denominator}"
    assert r == exp


@given(st.floats(-1e6, 1e6))
def test_fractional_close(x):
    r = fractional(x)
    parts = r.split(" ")
    if len(parts) == 2:
        w = int(parts[0])
        n, d = parts[1].split("/")
        v = abs(w) + int(n) / int(d)
        v = v if w >= 0 else -v
    elif "/" in r:
        n, d = r.split("/")
        v = int(n) / int(d)
    else:
        v = float(r)
    assert abs(v - x) < 1e-3 + 1e-9 * abs(x)


@given(st.integers(-100, 100), st.one_of(st.none(), st.integers(-100, 100)),
       st.one_of(st.none(), st.integers(-100, 100)))
def test_clamp(v, lo, hi):
    assume(lo is None or hi is None or lo <= hi)
    r = clamp(v, "{}", lo, hi)
    if lo is not None and v < lo:
        assert r == f"<{lo}"
    elif hi is not None and v > hi:
        assert r == f">{hi}"
    else:
        assert r == str(v)


@given(st.integers(-100, 100), st.integers(-100, 100), st.integers(-100, 100))
def test_clamp_callable(v, lo, hi):
    assume(lo <= hi)
    assert clamp(v, str, lo, hi, "L", "H") == clamp(v, "{}", lo, hi, "L", "H")
