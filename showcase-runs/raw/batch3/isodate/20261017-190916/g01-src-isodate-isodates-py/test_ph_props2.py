from datetime import date
from hypothesis import given, strategies as st
from isodate.isodates import parse_date

dates = st.dates(min_value=date(1, 1, 4), max_value=date(9998, 12, 28))


@given(dates, st.integers(5, 7))
def test_expanded_week_ord(d, n):
    y, w, wd = d.isocalendar()
    assert parse_date("+%0*d-W%02d-%d" % (n, y, w, wd), yeardigits=n) == d
    assert parse_date("+%0*dW%02d%d" % (n, y, w, wd), yeardigits=n) == d
    assert parse_date("+%0*d-%03d" % (n, d.year, d.timetuple().tm_yday), yeardigits=n) == d
    assert parse_date("+%0*d%02d" % (n, d.year, d.month), yeardigits=n) == date(d.year, d.month, 1)
    assert parse_date("+%0*d" % (n, d.year), yeardigits=n) == date(d.year, 1, 1)


@given(dates)
def test_expanded4(d):
    assert parse_date("+%04d-%02d-%02d" % (d.year, d.month, d.day), expanded=True) == d
    assert parse_date("%04d-%02d-%02d" % (d.year, d.month, d.day), expanded=True) == d


@given(st.integers(1, 9999), st.integers(1, 12), st.integers(1, 28))
def test_defaults_week_ord(y, m, dd):
    assert parse_date("%04d-W01" % y, defaultmonth=m, defaultday=dd) == date.fromisocalendar(y, 1, 1) if y > 1 else True


@given(st.integers(1, 99), st.integers(1, 12), st.integers(1, 28))
def test_century_defaults(c, m, dd):
    assert parse_date("%02d" % c, defaultmonth=m, defaultday=dd) == date(c * 100 + 1, m, dd)
