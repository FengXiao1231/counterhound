from datetime import time, timezone
from hypothesis import given, assume, settings, strategies as st
from isodate.isotime import parse_time, time_isoformat, build_time_regexps

h = st.integers(0, 23)
ms = st.integers(0, 59)
frac = st.text("0123456789", min_size=1, max_size=12)
sep = st.sampled_from([".", ","])


@given(h, ms, ms, st.integers(0, 999999))
def test_roundtrip_extended(hh, mm, ss, us):
    t = time(hh, mm, ss, us)
    assert parse_time(time_isoformat(t, "%H:%M:%S.%f")) == t


@given(h, ms, ms)
def test_basic_complete(hh, mm, ss):
    assert parse_time("%02d%02d%02d" % (hh, mm, ss)) == time(hh, mm, ss)
    assert parse_time("T%02d:%02d:%02dZ" % (hh, mm, ss)) == time(hh, mm, ss, tzinfo=timezone.utc)


@given(h, frac, sep)
def test_hour_fraction_no_crash(hh, f, s):
    t = parse_time("%02d%s%s" % (hh, s, f))
    exact = hh * 3600 + float("0." + f) * 3600
    got = t.hour * 3600 + t.minute * 60 + t.second + t.microsecond / 1e6
    assert abs(got - exact) < 1e-3


@given(h, ms, frac, sep)
def test_minute_fraction_no_crash(hh, mm, f, s):
    t = parse_time("%02d:%02d%s%s" % (hh, mm, s, f))
    exact = hh * 3600 + mm * 60 + float("0." + f) * 60
    got = t.hour * 3600 + t.minute * 60 + t.second + t.microsecond / 1e6
    assert abs(got - exact) < 1e-3


@given(h, ms, ms, frac, sep)
def test_second_fraction_no_crash(hh, mm, ss, f, s):
    t = parse_time("%02d%02d%02d%s%s" % (hh, mm, ss, s, f))
    assert (t.hour, t.minute, t.second) == (hh, mm, ss)


@given(st.text(max_size=12))
def test_only_iso_error(s):
    try:
        parse_time(s)
    except ValueError:
        pass
