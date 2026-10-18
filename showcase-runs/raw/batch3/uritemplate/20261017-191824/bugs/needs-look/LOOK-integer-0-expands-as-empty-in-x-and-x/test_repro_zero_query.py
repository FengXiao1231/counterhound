from uritemplate.api import expand


def test_repro_zero_query():
    assert expand("{?a}", {"a": 0}) == "?a=0"
    assert expand("{;a}", {"a": 0}) == ";a=0"
