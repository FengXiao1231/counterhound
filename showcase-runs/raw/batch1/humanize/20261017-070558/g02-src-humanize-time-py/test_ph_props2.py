import re
import sys
import types
import datetime as dt

_v = types.ModuleType("humanize._version")
_v.__version__ = "0"
sys.modules.setdefault("humanize._version", _v)

from hypothesis import given, assume, settings, strategies as st
from humanize.time import naturaltime, naturaldelta, precisedelta

UNITS = {"year": 365 * 86400, "month": 30.5 * 86400, "day": 86400, "hour": 3600,
         "minute": 60, "second": 1, "millisecond": 1e-3, "microsecond": 1e-6}
all_units = ["microseconds", "milliseconds", "seconds", "minutes", "hours", "days", "months", "years"]


def parse(s):
    total = 0
    for num, unit in re.findall(r"([\d,\.]+) (year|month|day|hour|minute|second|millisecond|microsecond)s?", s):
        total += float(num.replace(",", "")) * UNITS[unit]
    return total


@given(st.floats(min_value=0, max_value=1e8, allow_nan=False),
       st.sampled_from(all_units),
       st.lists(st.sampled_from(all_units), max_size=7, unique=True))
def test_precise_approx(sec, mu, sup):
    assume(not (mu in sup and all(u in sup for u in all_units[all_units.index(mu) + 1:])))
    s = precisedelta(sec, minimum_unit=mu, suppress=sup)
    # effective min unit
    i = all_units.index(mu)
    while all_units[i] in sup:
        i += 1
    eff = {"microseconds": 1e-6, "milliseconds": 1e-3, "seconds": 1, "minutes": 60, "hours": 3600,
           "days": 86400, "months": 30.5 * 86400, "years": 365 * 86400}[all_units[i]]
    tol = eff * 0.51 + 86400 + 1e-5
    assert abs(parse(s) - sec) <= tol, s


@given(st.floats(min_value=0, max_value=1e7, allow_nan=False), st.sampled_from(["seconds", "milliseconds", "microseconds"]), st.booleans())
def test_naturaldelta_float_vs_timedelta(sec, mu, months):
    assert naturaldelta(sec, months, mu) == naturaldelta(dt.timedelta(seconds=sec), months, mu)


@given(st.integers(0, 10**9), st.booleans())
def test_naturaltime_future_flag_ignored_for_td(sec, future):
    when = dt.datetime(2020, 1, 1)
    td = dt.timedelta(seconds=sec)
    assert naturaltime(td, future=future, when=when) == naturaltime(td, when=when)
