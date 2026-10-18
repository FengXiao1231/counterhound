from rfc3986.api import normalize_uri, uri_reference


def test_repro_path_becomes_authority():
    # path "/.//b" normalizes to "//b"; with no authority the result
    # "a://b" re-parses with host "b" instead of path "//b".
    n = normalize_uri("a:/.//b")
    assert uri_reference(n).authority is None
