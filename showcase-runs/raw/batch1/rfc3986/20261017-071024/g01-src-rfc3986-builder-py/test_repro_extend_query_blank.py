from rfc3986.builder import URIBuilder


def test_repro_extend_query_blank():
    b = URIBuilder(query="a=").extend_query_with([("b", "c")])
    assert b.query == "a=&b=c"
