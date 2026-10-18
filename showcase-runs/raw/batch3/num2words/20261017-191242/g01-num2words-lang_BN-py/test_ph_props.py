from decimal import Decimal
from hypothesis import given, strategies as st
from num2words.lang_BN import Num2Word_BN, AKOK

N = Num2Word_BN()
DIGITS = {AKOK[i]: str(i) for i in range(1, 10)}
DIGITS['শূন্য'] = '0'


@given(st.integers(0, 10**6), st.integers(0, 99))
def test_currency_paisa_exact(taka, paisa):
    s = f"{taka}.{paisa:02d}"
    out = N.to_currency(s)
    if paisa:
        assert out.endswith(N._number_to_bengali_word(paisa) + ' পয়সা'), (s, out)
    else:
        assert 'পয়সা' not in out


@given(st.integers(0, 10**6), st.integers(0, 10**4))
def test_cardinal_decimal_digits_preserved(whole, frac):
    width = st.just(4)
    s = f"{whole}.{frac:04d}".rstrip('0')
    assert '.' in s
    frac_digits = s.split('.')[1]
    out = N.to_cardinal(s)
    if frac_digits == '':
        return
    tail = out.split('দশমিক')[1].split() if 'দশমিক' in out else []
    got = ''.join(DIGITS[w] for w in tail)
    assert got == frac_digits, (s, out)


@given(st.integers(0, 10**12))
def test_cardinal_no_crash(n):
    assert N.to_cardinal(n)
    assert N.to_year(n).endswith('সাল')
    assert N.to_ordinal_num(n)
