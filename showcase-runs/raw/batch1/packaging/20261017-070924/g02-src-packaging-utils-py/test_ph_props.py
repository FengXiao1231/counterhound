import re
from hypothesis import given, assume, settings, strategies as st
import pytest
from packaging.utils import *
from packaging.version import Version, InvalidVersion
from packaging.tags import Tag

valid_name = st.from_regex(r"[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]", fullmatch=True)


@given(valid_name)
def test_canon_idempotent(n):
    c = canonicalize_name(n, validate=True)
    assert canonicalize_name(c, validate=True) == c
    assert is_normalized_name(c)


@given(valid_name)
def test_canon_matches_pep503(n):
    assert canonicalize_name(n) == re.sub(r"[-_.]+", "-", n).lower()


@given(st.text())
def test_is_normalized_iff(n):
    exp = bool(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", n, re.ASCII))
    assert is_normalized_name(n) == exp


@given(valid_name)
def test_normalized_roundtrip(n):
    assert is_normalized_name(n) == (canonicalize_name(n) == n)


@given(st.from_regex(r"[0-9]{1,3}(\.[0-9]{1,3}){0,4}((a|b|rc)[0-9]{1,2})?(\.post[0-9])?(\.dev[0-9])?(\+[a-z0-9]{1,3})?", fullmatch=True), st.booleans())
def test_version_props(s, strip):
    v = Version(s)
    c = canonicalize_version(s, strip_trailing_zero=strip)
    assert Version(c) == v
    assert canonicalize_version(c, strip_trailing_zero=strip) == c
    assert canonicalize_version(v, strip_trailing_zero=strip) == c
    if not strip:
        assert c == str(v)


@given(st.text())
def test_version_total(s):
    r = canonicalize_version(s)
    assert isinstance(r, str)
    try:
        Version(s)
    except InvalidVersion:
        assert r == s


@given(st.from_regex(r"[A-Za-z0-9_.]+", fullmatch=True).filter(lambda x: "__" not in x),
       st.sampled_from(["1.0", "2.0.post1", "1!3.4rc1", "0.1.dev3"]),
       st.sampled_from([None, "1", "2abc", "10_x"]),
       st.sampled_from(["py3-none-any", "cp39.cp310-abi3-manylinux1_x86_64.manylinux2010_x86_64"]))
def test_wheel_roundtrip(n, v, b, t):
    fn = "-".join([n, v] + ([b] if b else []) + [t]) + ".whl"
    name, ver, build, tags = parse_wheel_filename(fn)
    assert name == canonicalize_name(n)
    assert ver == Version(v)
    if b:
        m = re.match(r"(\d+)(.*)", b)
        assert build == (int(m.group(1)), m.group(2))
    else:
        assert build == ()
    assert all(isinstance(x, Tag) for x in tags)


@given(st.text(max_size=30))
def test_wheel_only_invalid_exc(s):
    try:
        parse_wheel_filename(s)
    except InvalidWheelFilename:
        pass


@given(st.text(max_size=30), st.booleans())
def test_wheel_only_invalid_exc2(s, vo):
    try:
        parse_wheel_filename("-".join(["a", "1", s]) + ".whl", validate_order=vo)
    except InvalidWheelFilename:
        pass


@given(st.text(max_size=30))
def test_sdist_only_invalid_exc(s):
    for ext in (".tar.gz", ".zip"):
        try:
            parse_sdist_filename(s + ext)
        except InvalidSdistFilename:
            pass


@given(st.from_regex(r"[A-Za-z0-9_.-]+", fullmatch=True),
       st.sampled_from(["1.0", "2.0.post1", "1!3.4rc1", "0.1.dev3"]),
       st.sampled_from([".tar.gz", ".zip"]))
def test_sdist_roundtrip(n, v, ext):
    name, ver = parse_sdist_filename(f"{n}-{v}{ext}")
    assert name == canonicalize_name(n)
    assert ver == Version(v)
