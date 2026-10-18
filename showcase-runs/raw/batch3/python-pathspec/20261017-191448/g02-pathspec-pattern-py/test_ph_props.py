import re
import copy
import warnings
from hypothesis import given, strategies as st
from pathspec.pattern import RegexPattern, Pattern


def valid(s):
    try:
        re.compile(s)
        return True
    except re.error:
        return False


rx = st.text(max_size=12).filter(valid)
bx = st.binary(max_size=12).filter(valid)


@given(rx)
def test_p2r_identity_str(p):
    assert RegexPattern.pattern_to_regex(p) == (p, True)


@given(bx)
def test_p2r_identity_bytes(p):
    assert RegexPattern.pattern_to_regex(p) == (p, True)


@given(rx, st.text(max_size=20))
def test_match_file_agrees_with_search(p, f):
    r = RegexPattern(p)
    m = r.match_file(f)
    ref = re.search(p, f)
    assert (m is None) == (ref is None)
    if m:
        assert m.match.group(0) == ref.group(0)


@given(bx, st.binary(max_size=20))
def test_match_file_bytes(p, f):
    m = RegexPattern(p).match_file(f)
    assert (m is None) == (re.search(p, f) is None)


@given(rx, st.lists(st.text(max_size=10), max_size=6))
def test_match_deprecated(p, files):
    r = RegexPattern(p)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        assert list(r.match(files)) == [f for f in files if r.match_file(f) is not None]


@given(rx, st.text(max_size=10))
def test_copy_eq(p, f):
    r = RegexPattern(p)
    c = copy.copy(r)
    assert c == r and c.pattern == r.pattern and str(c) == str(r)
    assert (c.match_file(f) is None) == (r.match_file(f) is None)


@given(st.text(max_size=10))
def test_null_pattern(f):
    r = RegexPattern(None)
    assert r.match_file(f) is None and r.include is None
    assert copy.copy(r) == r


@given(rx, st.booleans())
def test_precompiled(p, inc):
    r = RegexPattern(re.compile(p), inc)
    assert r.include is inc and str(r) == str(re.compile(p))


def test_base_not_impl():
    try:
        Pattern(True).match_file("a")
    except NotImplementedError:
        pass
    else:
        assert False
