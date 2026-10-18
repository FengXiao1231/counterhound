from boltons.urlutils import QueryParamDict


def test_repro_semicolon():
    d = QueryParamDict([('a', 'b;c')])
    text = d.to_text(full_quote=True)
    assert QueryParamDict.from_text(text).items(multi=True) == [('a', 'b;c')], text
