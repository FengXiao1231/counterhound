from datetime import date, time, datetime, timedelta, timezone
from hypothesis import given, assume, settings, strategies as st
from dateutil import tz
from dateutil.parser.isoparser import isoparser

P = isoparser()
PT = isoparser(sep='T')

dates = st.dates(min_value=date(1, 1, 1), max_value=date(9999, 12, 31))
times = st.times()
offs = st.tuples(st.sampled_from([1, -1]), st.integers(0, 23), st.integers(0, 59))


def fmt_off(o, colon=True, short=False):
    s, h, m = o
    sign = '+' if s > 0 else '-'
    if short:
        return '%s%02d' % (sign, h)
    return '%s%02d%s%02d' % (sign, h, ':' if colon else '', m)


def secs(o):
    return o[0] * (o[1] * 60 + o[2]) * 60


@given(dates)
def test_date_roundtrip(d):
    assert P.parse_isodate(d.strftime('%Y-%m-%d') if d.year >= 1000 else '%04d-%02d-%02d' % (d.year, d.month, d.day)) == d
    assert P.parse_isodate('%04d%02d%02d' % (d.year, d.month, d.day)) == d


@given(dates)
def test_week_roundtrip(d):
    y, w, wd = d.isocalendar()
    assume(1 <= y <= 9999)
    assert P.parse_isodate('%04d-W%02d-%d' % (y, w, wd)) == d
    assert P.parse_isodate('%04dW%02d%d' % (y, w, wd)) == d


@given(dates)
def test_ordinal_roundtrip(d):
    n = d.timetuple().tm_yday
    assert P.parse_isodate('%04d-%03d' % (d.year, n)) == d
    assert P.parse_isodate('%04d%03d' % (d.year, n)) == d


@given(times, st.sampled_from([',', '.']), st.booleans(), st.integers(1, 6))
def test_time_roundtrip(t, dec, colon, nd):
    c = ':' if colon else ''
    s = '%02d%s%02d%s%02d%s%s' % (t.hour, c, t.minute, c, t.second, dec, ('%06d' % t.microsecond)[:nd])
    exp = t.replace(microsecond=int(('%06d' % t.microsecond)[:nd]) * 10 ** (6 - nd))
    assert P.parse_isotime(s) == exp


@given(offs, st.booleans(), st.booleans())
def test_tz_roundtrip(o, colon, zero_as_utc):
    r = P.parse_tzstr(fmt_off(o, colon), zero_as_utc)
    if secs(o) == 0 and zero_as_utc:
        assert r == tz.UTC
    else:
        assert r.utcoffset(None) == timedelta(seconds=secs(o))


@given(offs)
def test_tz_short(o):
    r = P.parse_tzstr(fmt_off(o, short=True))
    assert r.utcoffset(None) == timedelta(seconds=o[0] * o[1] * 3600)


@given(dates, times, offs, st.booleans())
def test_isoparse_full(d, t, o, colon):
    s = '%04d-%02d-%02dT%02d:%02d:%02d.%06d%s' % (d.year, d.month, d.day, t.hour, t.minute, t.second, t.microsecond, fmt_off(o, colon))
    r = PT.isoparse(s)
    assert r.replace(tzinfo=None) == datetime.combine(d, t)
    assert r.utcoffset() == timedelta(seconds=secs(o))


@given(dates)
def test_isoparse_midnight24(d):
    assume(d < date(9999, 12, 31))
    r = PT.isoparse('%04d-%02d-%02dT24:00' % (d.year, d.month, d.day))
    assert r == datetime.combine(d + timedelta(days=1), time(0))
    assert P.parse_isotime('24:00') == time(0)


@given(dates)
def test_isoparse_24_last_day(d):
    s = '9999-12-31T24:00'
    try:
        PT.isoparse(s)
    except ValueError:
        pass


@given(st.integers(1, 9999), st.integers(1, 53), st.integers(1, 7))
def test_week_valid_year(y, w, wd):
    try:
        r = P.parse_isodate('%04d-W%02d-%d' % (y, w, wd))
    except ValueError:
        return
    assert r.isocalendar()[:3] == (y, w, wd)


@given(st.text(max_size=12))
def test_isoparse_only_valueerror(s):
    try:
        P.isoparse(s)
    except ValueError:
        pass


@given(st.text(alphabet='0123456789-+:TZW.,', max_size=14))
def test_isoparse_only_valueerror2(s):
    try:
        P.isoparse(s)
    except ValueError:
        pass


@given(st.text(alphabet='0123456789-+:Zz.,', max_size=14))
def test_isotime_only_valueerror(s):
    try:
        P.parse_isotime(s)
    except ValueError:
        pass


@given(st.text(alphabet='0123456789-+:Zz', max_size=8), st.booleans())
def test_tzstr_only_valueerror(s, z):
    try:
        P.parse_tzstr(s, z)
    except ValueError:
        pass
