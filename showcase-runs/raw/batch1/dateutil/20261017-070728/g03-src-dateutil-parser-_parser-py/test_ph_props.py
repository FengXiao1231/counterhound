from datetime import datetime
from hypothesis import given, assume, settings, strategies as st
from dateutil.parser._parser import parserinfo, parse

P = parserinfo()


@given(st.integers(0, 99))
def test_convertyear_window(y):
    r = P.convertyear(y)
    assert P._year - 50 <= r < P._year + 50
    assert r % 100 == y


@given(st.integers(0, 9999), st.booleans())
def test_convertyear_identity_when_long(y, cs):
    r = P.convertyear(y, cs)
    if y >= 100 or cs:
        assert r == y


@given(st.integers(0, 99))
def test_convertyear_idempotent(y):
    r = P.convertyear(y)
    assert P.convertyear(r) == r


@given(st.sampled_from(["mon", "Monday", "TUE", "sunday", "Sun"]))
def test_weekday_case(n):
    assert P.weekday(n) == P.weekday(n.upper()) == P.weekday(n.lower())
    assert P.weekday(n) in range(7)


@given(st.text(max_size=8))
def test_weekday_month_hms_total(n):
    for f in (P.weekday, P.month, P.hms, P.ampm):
        r = f(n)
        assert r is None or isinstance(r, int)


@given(st.sampled_from(["h", "hour", "hours", "m", "minute", "minutes", "s", "second", "seconds"]))
def test_hms_values(n):
    assert P.hms(n) in (0, 1, 2)


@given(st.datetimes(min_value=datetime(1000, 1, 1), max_value=datetime(9000, 1, 1)))
def test_parse_isoformat_roundtrip(d):
    assert parse(d.isoformat()) == d


@given(st.datetimes(min_value=datetime(1000, 1, 1), max_value=datetime(9000, 1, 1)))
def test_parse_str_roundtrip(d):
    assert parse(str(d)) == d


@given(st.datetimes(min_value=datetime(1000, 1, 1), max_value=datetime(9000, 1, 1)))
def test_parse_fmt_roundtrip(d):
    assert parse(d.strftime("%d %B %Y %I:%M:%S %p")) == d.replace(microsecond=0)
    assert parse(d.strftime("%a, %d %b %Y %H:%M:%S")) == d.replace(microsecond=0)
    assert parse(d.strftime("%Y%m%dT%H%M%S")) == d.replace(microsecond=0)


@given(st.datetimes(min_value=datetime(1000, 1, 1), max_value=datetime(9000, 1, 1)))
def test_parse_dayfirst(d):
    s = d.strftime("%d/%m/%Y %H:%M")
    assert parse(s, dayfirst=True) == d.replace(second=0, microsecond=0)
    s = d.strftime("%m/%d/%Y")
    assert parse(s, dayfirst=False) == d.replace(hour=0, minute=0, second=0, microsecond=0)
    s = d.strftime("%Y/%m/%d")
    assert parse(s, yearfirst=True) == d.replace(hour=0, minute=0, second=0, microsecond=0)


@given(st.datetimes(min_value=datetime(1000, 1, 1), max_value=datetime(9000, 1, 1)),
       st.datetimes(min_value=datetime(1000, 1, 1), max_value=datetime(9000, 1, 1)))
def test_parse_default_not_used_when_full(d, dflt):
    assert parse(d.isoformat(), default=dflt) == d


@given(st.integers(-12, 14), st.integers(0, 59))
def test_parse_tzoffset(h, m):
    s = "2020-01-02T03:04:05%s%02d:%02d" % ("+" if h >= 0 else "-", abs(h), m)
    r = parse(s)
    sign = 1 if h >= 0 else -1
    assert r.utcoffset().total_seconds() == sign * (abs(h) * 3600 + m * 60)


@given(st.integers(0, 99), st.integers(1, 12), st.integers(1, 28))
def test_parse_twodigit_year(y, m, d):
    r = parse("%02d-%02d-%02d" % (y, m, d), yearfirst=True)
    assert r.year % 100 == y
    assert P._year - 50 <= r.year < P._year + 50


@given(st.text(max_size=20))
def test_parse_only_valueerror(s):
    try:
        parse(s)
    except (ValueError, OverflowError):
        pass
