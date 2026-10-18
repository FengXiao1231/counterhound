from parse import parse


def test_repro_tz_groups():
    r = parse("{:%Y-%m-%d %H:%M:%S%z}|{}", "2020-03-04 05:06:07+0200|abc")
    assert r is not None
    assert r[1] == "abc"
