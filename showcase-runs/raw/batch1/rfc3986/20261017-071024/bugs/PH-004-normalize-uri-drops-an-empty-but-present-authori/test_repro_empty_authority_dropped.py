from rfc3986.api import normalize_uri


def test_repro_empty_authority_dropped():
    # "file:///etc/hosts" has an empty (but present) authority; normalizing
    # must not change the URI's structure.
    assert normalize_uri("file:///etc/hosts") == "file:///etc/hosts"
