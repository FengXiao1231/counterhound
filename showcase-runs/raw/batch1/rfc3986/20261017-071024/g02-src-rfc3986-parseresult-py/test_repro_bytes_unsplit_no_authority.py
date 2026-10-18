from rfc3986.parseresult import ParseResultBytes


def test_repro_bytes_unsplit_no_authority():
    pr = ParseResultBytes.from_string(b"/a")
    assert pr.unsplit() == b"/a"
