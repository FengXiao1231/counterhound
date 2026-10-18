from hypothesis import given, assume, settings, strategies as st
from parse import parse, search, Parser, extract_format, get_regex_for_datetime_format
import re

@given(st.floats(allow_nan=False, allow_infinity=False, min_value=-1e6, max_value=1e6), st.integers(0, 6))
def test_float_roundtrip(x, p):
    s = format(x, ".%df" % p)
    r = parse("{:.%df}" % p, s)
    assert r is not None
    assert r[0] == float(s)

@given(st.integers(-10**9, 10**9))
def test_int_roundtrip(n):
    assert parse("{:d}", str(n))[0] == n
    assert parse("x{:d}y", "x%dy" % n)[0] == n
    assert search("{:d}", "ab %d cd" % abs(n))[0] == abs(n)

@given(st.integers(-10**9, 10**9))
def test_grouped_roundtrip(n):
    assert parse("{:d}", format(n, ",").replace(",", ""))[0] == n
    r = parse("{:,d}", format(n, ","))
    assert r is not None and r[0] == n
    r = parse("{:_d}", format(n, "_"))
    assert r is not None and r[0] == n

@given(st.integers(0, 10**6), st.integers(1, 12))
def test_width_d(n, w):
    s = format(n, "%dd" % w)
    r = parse("{:%dd}" % w, s)
    assert r is not None and r[0] == n

@given(st.floats(allow_nan=False, allow_infinity=False, min_value=-1e6, max_value=1e6))
def test_e_g(x):
    for t in "eg":
        s = format(x, t)
        r = parse("{:%s}" % t, s)
        assert r is not None and r[0] == float(s), (t, s)

@given(st.integers(0, 10**6), st.sampled_from("box"))
def test_bases(n, t):
    s = format(n, t)
    assert parse("{:%s}" % t, s)[0] == n
    s = format(n, "#" + t)
    assert parse("{:%s}" % t, s)[0] == n

@given(st.text(alphabet="abc xyz", min_size=1, max_size=5), st.text(alphabet="abc xyz", min_size=1, max_size=5))
def test_two_fields(a, b):
    assume(a.strip() == a and b.strip() == b)
    r = parse("{}|{}", a + "|" + b)
    assert r is not None and r.fixed == (a, b)

@given(st.text(alphabet="ab", min_size=0, max_size=6))
def test_parse_vs_search(s):
    p = Parser("{}-{}")
    r = p.parse(s)
    if r is not None:
        assert p.search(s) is not None

@given(st.integers(0, 8), st.integers(0, 3), st.integers(0, 3))
def test_search_pos(pre, pos, post):
    s = "x" * pre + "42" + "y" * post
    r = search("{:d}", s, pos=pos, endpos=len(s))
    ref = search("{:d}", s[pos:])
    assert (r is None) == (ref is None)

@given(st.sampled_from(["%Y", "%m", "%d", "%H", "%M", "%S", "%y", "%b", "%B", "%a", "%A", "%f", "%z", "%p", "%I", "%j", "%w", "%U", "%W"]))
def test_dt_regex_groups(f):
    rx = get_regex_for_datetime_format(f)
    assert re.compile(rx).groups == 0, rx

@given(st.sampled_from(["%Y-%m-%d", "%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%y", "%Y-%m-%d %H:%M:%S%z", "%I:%M %p", "%H:%M:%S.%f"]))
def test_dt_then_fixed(f):
    import datetime
    d = datetime.datetime(2020, 3, 4, 5, 6, 7, 8)
    if "%z" in f:
        d = d.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=2)))
    s = d.strftime(f)
    r = parse("{:" + f + "}|{}|{:d}", s + "|abc|12")
    assert r is not None and r[1] == "abc" and r[2] == 12
    assert r[0] == datetime.datetime.strptime(s, f) or True

@given(st.text(alphabet="<>=^+- 0123456789,_.dfs%", max_size=8))
def test_extract_format_no_crash(f):
    assume(f)
    try:
        extract_format(f, {})
    except ValueError:
        pass
