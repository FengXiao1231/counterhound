from uritemplate.api import expand, partial


def test_repro_partial_empty():
    assert str(partial("a{x}b", {"x": ""})) == expand("a{x}b", {"x": ""}) == "ab"
