from hypothesis import given, assume, strategies as st
from boltons.strutils import *

ints = st.lists(st.integers(0, 200))

@given(ints, st.booleans())
def test_roundtrip(l, sp):
    assert parse_int_list(format_int_list(l, delim_space=sp).replace(' ', '')) == sorted(set(l))

@given(ints, st.sampled_from([',', ';', '|']), st.sampled_from(['-', ':', '~']))
def test_roundtrip_delims(l, d, r):
    assert parse_int_list(format_int_list(l, d, r), d, r) == sorted(set(l))

@given(ints)
def test_ranges(l):
    s = '' if not l else format_int_list(l)
    r = int_ranges_from_int_list(s)
    exp = set()
    for a, b in r:
        assert a <= b
        exp |= set(range(a, b + 1))
    assert exp == set(l)

@given(st.text())
def test_splitlines(t):
    lines = list(iter_splitlines(t))
    assert all(not any(c in l for c in '\n\r\x0b\f\x85  ') for l in lines)

@given(st.text(), st.text())
def test_strip_ansi(a, b):
    assume('\x1b' not in a + b and '\x9b' not in a + b)
    assert strip_ansi(a + '\x1b[1;31m' + b) == a + b
    assert strip_ansi(a.encode()) == a.encode()

@given(st.lists(st.text()))
def test_sh_roundtrip(args):
    import shlex
    assume(all('\x00' not in a for a in args))
    assert shlex.split(escape_shell_args(args, style='sh')) == args
