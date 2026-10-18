import re
from hypothesis import given, assume, settings, strategies as st
from humanfriendly import *


@given(st.integers(0, 10**27), st.booleans())
def test_size_roundtrip(n, binary):
    s = format_size(n, binary=binary)
    p = parse_size(s, binary=binary)
    if n:
        assert abs(p - n) <= n * 0.006 + 1, (s, p)


@given(st.integers(0, 10**27), st.booleans(), st.booleans())
def test_size_format_nice(n, kw, binary):
    s = format_size(n, keep_width=kw, binary=binary)
    m = re.match(r'^(\d+(?:\.\d+)?) (\w+)$', s)
    assert m, s
    if m.group(2) not in ('byte', 'bytes'):
        assert float(m.group(1)) < 1000, s


@given(st.integers(0, 10**27), st.booleans())
def test_size_monotone_unit(n, binary):
    a = format_size(n, binary=binary)
    b = format_size(n + 1, binary=binary)
    assert a and b


@given(st.integers(0, 10**12))
def test_parse_size_int(n):
    assert parse_size(str(n)) == n
    assert parse_size('%d bytes' % n) == n
    assert parse_size('%d KiB' % n) == n * 1024
    assert parse_size('%d KB' % n) == n * 1000
    assert parse_size('%d KB' % n, binary=True) == n * 1024


@given(st.floats(0, 1e7, allow_nan=False), st.booleans())
def test_length_roundtrip(x, kw):
    s = format_length(x, keep_width=kw)
    p = parse_length(s)
    assert abs(p - x) <= max(x * 0.006, 1e-9), (s, p)


@given(st.integers(0, 10**6), st.sampled_from(['nm', 'mm', 'cm', 'm', 'km', 'metre', 'metres', 'meters']))
def test_parse_length_units(n, u):
    div = {'nm': 1e-9, 'mm': 1e-3, 'cm': 1e-2, 'm': 1, 'km': 1000, 'metre': 1, 'metres': 1, 'meters': 1}[u]
    assert abs(parse_length('%d %s' % (n, u)) - n * div) <= 1e-9 * max(1, n * div)


@given(st.integers(0, 10**9), st.booleans(), st.integers(1, 9))
def test_timespan_int_roundtrip_detailed(n, detailed, mu):
    s = format_timespan(n, detailed=detailed, max_units=mu)
    if detailed or mu >= 9:
        # parse each component
        parts = re.split(r', | and ', s)
        total = sum(parse_timespan(p) for p in parts)
        assert total == n, (s, total)


@given(st.integers(0, 10**9), st.integers(1, 9))
def test_timespan_units_count(n, mu):
    s = format_timespan(n, max_units=mu)
    parts = re.split(r', | and ', s)
    assert len(parts) <= mu, s
    assert s


@given(st.integers(60, 10**9))
def test_timespan_max_units_1(n):
    s = format_timespan(n, max_units=1)
    assert ' and ' not in s and ',' not in s, s


@given(st.floats(0, 1e6, allow_nan=False))
def test_timespan_float_detailed(x):
    s = format_timespan(x, detailed=True)
    parts = re.split(r', | and ', s)
    total = sum(parse_timespan(p) for p in parts)
    assert abs(total - x) < 1e-3 + x * 1e-9, (s, total)


@given(st.integers(0, 10**6), st.sampled_from([u for u in time_units]))
def test_parse_timespan_units(n, u):
    for name in [u['singular'], u['plural']] + u['abbreviations']:
        assert abs(parse_timespan('%d%s' % (n, name)) - n * u['divider']) < 1e-6 * max(1, n * u['divider'])
        assert abs(parse_timespan('%d %s' % (n, name)) - n * u['divider']) < 1e-6 * max(1, n * u['divider'])
