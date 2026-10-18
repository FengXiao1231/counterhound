from uritemplate.api import expand


def test_repro_int_prefix():
    assert expand("{a:1}", {"a": 12}) == "1"
