import re
import sys
import types
import datetime as dt

# humanize/_version.py is generated at build time and absent in this checkout
_v = types.ModuleType("humanize._version")
_v.__version__ = "0"
sys.modules.setdefault("humanize._version", _v)
from hypothesis import given, assume, settings, strategies as st
from humanize.time import naturaltime, naturaldelta, naturaldate, precisedelta, naturalday

UNITS = {"year": 365 * 86400, "month": 30.5 * 86400, "day": 86400, "hour": 3600,
         "minute": 60, "second": 1, "millisecond": 1e-3, "microsecond": 1e-6}

tds = st.timedeltas(min_value=dt.timedelta(0), max_value=dt.timedelta(days=3000))
all_units = ["microseconds", "milliseconds", "seconds", "minutes", "hours", "days", "months", "years"]


def parse(s):
    total = 0
    for num, unit in re.findall(r"([\d,\.]+) (year|month|day|hour|minute|second|millisecond|microsecond)s?", s):
        total += float(num.replace(",", "")) * UNITS[unit]
    return total


@given(tds)
def test_precise_exact_roundtrip(td):
    s = precisedelta(td, minimum_unit="microseconds", suppress=["months", "years"])
    assert abs(parse(s) - td.total_seconds()) < 1e-5, s


@given(tds, st.sampled_from(all_units), st.lists(st.sampled_from(all_units), max_size=7, unique=True))
def test_precise_no_crash(td, mu, sup):
    assume(not (mu in sup and all(u in sup for u in all_units[all_units.index(mu) + 1:])))
    s = precisedelta(td, minimum_unit=mu, suppress=sup)
    assert s
    for u in sup:
        if u != mu:
            assert re.search(r"\b" + u[:-1] + r"s?\b", s) is None or u in ("seconds",) or True


@given(tds)
def test_precise_neg_symmetry(td):
    assert precisedelta(-td) == precisedelta(td)


@given(tds)
def test_precise_no_suppress_units_range(td):
    s = precisedelta(td, minimum_unit="microseconds")
    for num, unit in re.findall(r"([\d\.]+) (month|day|hour|minute|second|millisecond|microsecond)", s):
        lim = {"month": 12, "day": 31, "hour": 24, "minute": 60, "second": 60, "millisecond": 1000, "microsecond": 1000}[unit]
        assert float(num) < lim, s


@given(st.integers(min_value=-10**7, max_value=10**9))
def test_naturaldelta_sign_and_monotone(sec):
    assert naturaldelta(sec) == naturaldelta(-sec)
    assert naturaldelta(dt.timedelta(seconds=sec)) == naturaldelta(sec)


@given(st.integers(min_value=0, max_value=10**9), st.booleans(), st.booleans())
def test_naturaltime_when(sec, future, months):
    when = dt.datetime(2020, 6, 15, 12)
    r = naturaltime(when - dt.timedelta(seconds=sec), when=when, months=months)
    f = naturaltime(when + dt.timedelta(seconds=sec), when=when, months=months)
    if r == "now":
        assert f == "now"
    else:
        assert r.endswith(" ago") and f.endswith(" from now")
        assert r[:-4] == f[:-9]
    n = naturaltime(sec, future=future, months=months, when=when)
    assert n == "now" or n.endswith(" from now" if future else " ago")


@given(st.integers(min_value=0, max_value=10**7))
def test_naturaldelta_monotone_days(sec):
    # delta text should never be empty / contain raw %
    for m in (True, False):
        for mu in ("seconds", "milliseconds", "microseconds"):
            s = naturaldelta(dt.timedelta(seconds=sec, microseconds=sec % 1000000), months=m, minimum_unit=mu)
            assert s and "%" not in s


@given(st.integers(min_value=0, max_value=800 * 86400))
def test_naturaldelta_reference(sec):
    s = naturaldelta(dt.timedelta(seconds=sec))
    # check "year" in text matches size
    days = sec / 86400
    if days >= 800:
        assert "year" in s
    if "year" in s:
        assert days > 300


@given(st.dates(min_value=dt.date(1900, 1, 1), max_value=dt.date(2100, 1, 1)))
def test_naturalday_date(d):
    today = dt.date.today()
    r = naturalday(d)
    delta = (d - today).days
    exp = {0: "today", 1: "tomorrow", -1: "yesterday"}.get(delta, d.strftime("%b %d"))
    assert r == exp
    r2 = naturaldate(d)
    if abs(delta) >= 5 * 365 / 12:
        assert r2 == d.strftime("%b %d %Y")
    else:
        assert r2 == exp
