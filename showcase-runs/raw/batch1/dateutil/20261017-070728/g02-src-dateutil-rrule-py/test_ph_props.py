from datetime import datetime, timedelta
from hypothesis import given, assume, settings, strategies as st
from dateutil.rrule import rrule, rruleset, DAILY

base = datetime(2020, 1, 1)
dts = st.integers(0, 40).map(lambda n: base + timedelta(days=n))
dtlists = st.lists(dts, max_size=15)
cache = st.booleans()


def build(rd, ex, c, rr_count=None, exr_count=None):
    s = rruleset(cache=c)
    for d in rd:
        s.rdate(d)
    for d in ex:
        s.exdate(d)
    if rr_count:
        s.rrule(rrule(DAILY, dtstart=base, count=rr_count))
    if exr_count:
        s.exrule(rrule(DAILY, dtstart=base + timedelta(days=1), interval=2, count=exr_count))
    return s


def ref(rd, ex, rr_count=None, exr_count=None):
    inc = set(rd)
    if rr_count:
        inc |= {base + timedelta(days=i) for i in range(rr_count)}
    exc = set(ex)
    if exr_count:
        exc |= {base + timedelta(days=1 + 2 * i) for i in range(exr_count)}
    return sorted(inc - exc)


args = dict(rd=dtlists, ex=dtlists, c=cache,
            rr=st.none() | st.integers(1, 20), exr=st.none() | st.integers(1, 10))


@given(**args)
def test_set_matches_reference(rd, ex, c, rr, exr):
    s = build(rd, ex, c, rr, exr)
    assert list(s) == ref(rd, ex, rr, exr)
    assert list(s) == ref(rd, ex, rr, exr)


@given(**args, dt=dts, inc=st.booleans())
def test_before_after(rd, ex, c, rr, exr, dt, inc):
    s = build(rd, ex, c, rr, exr)
    r = ref(rd, ex, rr, exr)
    b = [x for x in r if (x <= dt if inc else x < dt)]
    a = [x for x in r if (x >= dt if inc else x > dt)]
    assert s.before(dt, inc) == (b[-1] if b else None)
    assert s.after(dt, inc) == (a[0] if a else None)


@given(**args, dt=dts, inc=st.booleans(), n=st.none() | st.integers(0, 6))
def test_xafter(rd, ex, c, rr, exr, dt, inc, n):
    s = build(rd, ex, c, rr, exr)
    r = ref(rd, ex, rr, exr)
    a = [x for x in r if (x >= dt if inc else x > dt)]
    if n is not None:
        a = a[:n]
    assert list(s.xafter(dt, n, inc)) == a


@given(rd=dtlists, ex=dtlists, extra=dts)
def test_cache_invalidation(rd, ex, extra):
    s = build(rd, ex, True)
    list(s)
    s.count()
    s.rdate(extra)
    assert list(s) == ref(rd + [extra], ex)
    s.exdate(extra)
    assert list(s) == ref(rd + [extra], ex + [extra])
    assert s.count() == len(ref(rd + [extra], ex + [extra]))
