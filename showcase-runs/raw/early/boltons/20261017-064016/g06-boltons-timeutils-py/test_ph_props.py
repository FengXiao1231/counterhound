from datetime import datetime, timedelta, timezone
from hypothesis import given, assume, strategies as st
from boltons.timeutils import (dt_to_timestamp, isoparse, parse_timedelta,
                               relative_time, decimal_relative_time, strpdate)

dts = st.datetimes(min_value=datetime(1900, 1, 1), max_value=datetime(2200, 1, 1))


@given(dts)
def test_isoparse_roundtrip(dt):
    assert isoparse(dt.isoformat()) == dt


@given(dts)
def test_isoparse_roundtrip_aware(dt):
    dt = dt.replace(tzinfo=timezone.utc)
    assert isoparse(dt.isoformat()) == dt


@given(dts)
def test_ts_roundtrip(dt):
    ts = dt_to_timestamp(dt)
    assert datetime.fromtimestamp(ts, timezone.utc).replace(tzinfo=None) == dt


@given(st.integers(-10**6, 10**6), st.sampled_from("wdhms"))
def test_parse_td_units(n, u):
    kw = {'w': 'weeks', 'd': 'days', 'h': 'hours', 'm': 'minutes', 's': 'seconds'}[u]
    assert parse_timedelta(f"{n}{u}") == timedelta(**{kw: n})


@given(st.text(alphabet="xyz !?", max_size=10))
def test_parse_td_garbage_raises(t):
    try:
        r = parse_timedelta(t)
    except ValueError:
        return
    assert False, r


@given(dts, st.integers(0, 10**9), st.integers(0, 9))
def test_relative_time_ndigits(d, secs, nd):
    other = d + timedelta(seconds=secs, microseconds=123456)
    val, unit = decimal_relative_time(d, other, nd)
    s = relative_time(d, other, nd)
    assert float(s.split()[0]) == abs(val)


@given(st.dates())
def test_strpdate(d):
    assert strpdate(d.strftime("%Y-%m-%d"), "%Y-%m-%d") == d
