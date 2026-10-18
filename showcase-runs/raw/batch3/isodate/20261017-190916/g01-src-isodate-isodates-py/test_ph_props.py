from datetime import date
from hypothesis import given, assume, settings, strategies as st
from isodate.isodates import build_date_regexps, parse_date, date_isoformat

dates = st.dates(min_value=date(1, 1, 4), max_value=date(9998, 12, 28))


@given(dates)
def test_extended_roundtrip(d):
    assert parse_date(d.strftime("%Y-%m-%d") if d.year >= 1000 else "%04d-%02d-%02d" % (d.year, d.month, d.day)) == d


@given(dates)
def test_basic_roundtrip(d):
    assert parse_date("%04d%02d%02d" % (d.year, d.month, d.day)) == d


@given(dates)
def test_week_extended(d):
    y, w, wd = d.isocalendar()
    assert parse_date("%04d-W%02d-%d" % (y, w, wd)) == d


@given(dates)
def test_week_basic(d):
    y, w, wd = d.isocalendar()
    assert parse_date("%04dW%02d%d" % (y, w, wd)) == d


@given(dates)
def test_week_reduced(d):
    y, w, wd = d.isocalendar()
    assert parse_date("%04d-W%02d" % (y, w)) == date.fromisocalendar(y, w, 1)
    assert parse_date("%04dW%02d" % (y, w)) == date.fromisocalendar(y, w, 1)


@given(dates)
def test_ordinal(d):
    doy = d.timetuple().tm_yday
    assert parse_date("%04d-%03d" % (d.year, doy)) == d
    assert parse_date("%04d%03d" % (d.year, doy)) == d


@given(st.integers(1, 9999), st.integers(1, 12))
def test_month(y, m):
    assert parse_date("%04d-%02d" % (y, m)) == date(y, m, 1)
    assert parse_date("%04d%02d" % (y, m)) == date(y, m, 1)


@given(st.integers(1, 9999), st.integers(1, 12), st.integers(1, 28))
def test_defaults(y, m, dd):
    assert parse_date("%04d" % y, defaultmonth=m, defaultday=dd) == date(y, m, dd)
    assert parse_date("%04d-%02d" % (y, m), defaultday=dd) == date(y, m, dd)


@given(st.integers(5, 8), st.integers(1, 9999), st.integers(1, 12), st.integers(1, 28))
def test_expanded(n, y, m, dd):
    s = "+%0*d-%02d-%02d" % (n, y, m, dd)
    if y < 10 ** n:
        assert parse_date(s, yeardigits=n) == date(y, m, dd)


@given(st.integers(0, 99))
def test_century(c):
    assume(c >= 1)
    assert parse_date("%02d" % c) == date(c * 100 + 1, 1, 1)


@given(st.integers(2, 9), st.booleans())
def test_regexps_cached_and_compile(n, e):
    r = build_date_regexps(n, e)
    assert r is build_date_regexps(n, e)
    assert len(r) == 12


@given(st.integers(0, 9999), st.integers(0, 99), st.integers(0, 99))
def test_no_unexpected_exception(y, m, dd):
    from isodate.isoerror import ISO8601Error
    try:
        parse_date("%04d-%02d-%02d" % (y, m, dd))
    except (ValueError, ISO8601Error):
        pass


@given(dates)
def test_format_roundtrip(d):
    assert parse_date(date_isoformat(d)) == d
