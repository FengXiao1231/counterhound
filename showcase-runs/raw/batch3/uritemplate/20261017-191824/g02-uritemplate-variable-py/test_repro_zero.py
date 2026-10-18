from uritemplate.variable import URIVariable


def test_repro_zero():
    assert URIVariable("?x").expand({"x": 0})["?x"] == "?x=0"
    assert URIVariable(";x").expand({"x": 0})[";x"] == ";x=0"
