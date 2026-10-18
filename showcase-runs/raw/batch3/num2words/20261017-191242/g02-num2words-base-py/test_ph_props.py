from decimal import Decimal
from hypothesis import given, assume, settings, strategies as st
from num2words.lang_EN import Num2Word_EN

n = Num2Word_EN()
DIG = ["zero","one","two","three","four","five","six","seven","eight","nine"]

def flatten(x):
    if isinstance(x, tuple): return [x]
    out = []
    for e in x: out += flatten(e)
    return out

@given(st.integers(min_value=0, max_value=10**15))
def test_splitnum_sum(v):
    assert sum(1 for _ in [0])  # sanity
    parts = n.splitnum(v)
    assert parts

@given(st.integers(min_value=-10**12, max_value=10**12))
def test_cardinal_neg_prefix(v):
    s = n.to_cardinal(v)
    if v < 0:
        assert s == "minus " + n.to_cardinal(-v)
    else:
        assert not s.startswith("minus")

@given(st.text(alphabet="0123456789", min_size=1, max_size=6),
       st.text(alphabet="0123456789", min_size=1, max_size=5),
       st.booleans())
def test_float_digits(a, b, neg):
    assume(not b.endswith("0"))
    s = ("-" if neg else "") + str(int(a)) + "." + b
    v = float(s)
    assume(Decimal(str(v)) == Decimal(s) and v != int(v))
    out = n.to_cardinal(v)
    words = out.split(" point ")
    assert len(words) == 2, out
    assert words[1].split() == [DIG[int(c)] for c in b], (s, out)
    exp_pre = n.to_cardinal(int(a))
    if neg:
        exp_pre = "minus " + exp_pre
    assert words[0] == exp_pre, (s, out)

@given(st.decimals(min_value=-10**6, max_value=10**6, places=2, allow_nan=False))
def test_currency_decimal(d):
    s = n.to_currency(d, currency="USD")
    assert ("minus" in s) == (d < 0)
    left = int(abs(d))
    assert n.to_cardinal(left) in s

@given(st.integers(min_value=-10**9, max_value=10**9))
def test_currency_int(v):
    s = n.to_currency(v, currency="EUR")
    assert ("minus" in s) == (v < 0)
    assert n.to_cardinal(abs(v)//100) in s

@given(st.integers(min_value=0, max_value=10**6), st.booleans())
def test_currency_float_vs_decimal(v, c):
    f = v/100
    assert n.to_currency(f, cents=c) == n.to_currency(Decimal(str(f)), cents=c)

@given(st.text(alphabet="-x", max_size=3))
def test_parse_minus(s):
    sym, rest = n.parse_minus(s)
    if s.startswith("-"):
        assert rest == s[1:] and sym.strip()
    else:
        assert sym == "" and rest == s

@given(st.floats(min_value=-1e6, max_value=1e6, allow_nan=False))
def test_float_no_crash(f):
    assume(f == 0 or abs(f) > 1e-5)
    n.to_cardinal(f)

@given(st.integers(min_value=-10**6, max_value=10**6).map(lambda i: i/1000))
def test_float_neg_symmetry(f):
    a = n.to_cardinal(f); b = n.to_cardinal(-f)
    if f > 0: assert b == "minus " + a
