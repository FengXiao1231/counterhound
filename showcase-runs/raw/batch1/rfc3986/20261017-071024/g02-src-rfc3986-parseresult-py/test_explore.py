import pytest
from rfc3986.parseresult import ParseResult, ParseResultBytes


@pytest.mark.parametrize("u", ["", "/a", "a:b", "?q"])
def test_bytes_from_string_encode(u):
    ParseResult.from_string(u).encode()


@pytest.mark.parametrize("u", ["", "/a", "a:b", "?q"])
def test_bytes_unsplit(u):
    ParseResultBytes.from_string(u).unsplit()


@pytest.mark.parametrize("u", ["", "/a", "a:b", "?q"])
def test_bytes_authority(u):
    ParseResultBytes.from_string(u).authority


@pytest.mark.parametrize("u", ["//[", "//[a", "//x@["])
def test_nonstrict(u):
    ParseResult.from_string(u, strict=False)
