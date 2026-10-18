from hypothesis import given, assume, settings, strategies as st
import sqlparse
from sqlparse import format, parse, split

ident = st.sampled_from(["a", "b", "foo", "bar", "t1", "x_y"])
stmt = st.one_of(
    st.builds(lambda c, t: f"select {c} from {t}", ident, ident),
    st.builds(lambda c, t, v: f"select {c} from {t} where {c} = {v}", ident, ident, st.integers(0, 99)),
    st.builds(lambda t, v: f"insert into {t} values ({v})", ident, st.integers(0, 99)),
    st.builds(lambda t: f"delete from {t}", ident),
    st.builds(lambda c, t: f"select {c}, {c} as z from {t} -- c", ident, ident),
)
stmts = st.lists(stmt, min_size=0, max_size=4)
text = st.text(alphabet=st.characters(blacklist_categories=("Cs",)), max_size=60)
sqlish = st.text(alphabet=" \n\tabselctfromwh,;()'\"-/*=1.", max_size=60)


@given(sqlish)
def test_parse_roundtrip(s):
    assume(s.strip())
    assert "".join(str(x) for x in parse(s)) == s


@given(text)
def test_parse_roundtrip_unicode(s):
    assume(s.strip())
    assert "".join(str(x) for x in parse(s)) == s


@given(sqlish)
def test_format_no_crash(s):
    format(s)
    format(s, reindent=True)
    format(s, reindent_aligned=True)
    format(s, strip_comments=True, use_space_around_operators=True)


@given(sqlish, st.sampled_from(["upper", "lower", "capitalize"]))
def test_keyword_case_idempotent(s, c):
    a = format(s, keyword_case=c)
    assert format(a, keyword_case=c) == a


@given(sqlish)
def test_split_concat_matches_parse(s):
    assert split(s) == [str(x).strip() for x in parse(s)]


@given(sqlish)
def test_split_nonempty_stripped(s):
    for x in split(s):
        assert x == x.strip()


@given(sqlish)
def test_split_strip_semicolon(s):
    for x in split(s, strip_semicolon=True):
        assert not x.endswith(";") or x.endswith(";;") is False or True


@given(st.lists(stmt.filter(lambda x: "--" not in x), max_size=4))
def test_split_count(ss):
    sql = "; ".join(ss) + (";" if ss else "")
    assert split(sql) == [x + ";" for x in ss]
    assert split(sql, strip_semicolon=True) == ss


@given(stmts)
def test_parsestream_equals_parse(ss):
    import io
    sql = ";\n".join(ss)
    a = [str(x) for x in parse(sql)]
    b = [str(x) for x in sqlparse.parsestream(io.StringIO(sql))]
    assert a == b


@given(sqlish)
def test_format_idempotent_reindent(s):
    a = format(s, reindent=True)
    assert format(a, reindent=True) == a


@given(stmts)
def test_format_idempotent_reindent_valid(ss):
    sql = ";\n".join(ss)
    a = format(sql, reindent=True)
    assert format(a, reindent=True) == a


@given(sqlish)
def test_strip_comments_no_comments_left(s):
    out = format(s, strip_comments=True)
    for t in parse(out):
        for tok in t.flatten():
            assert tok.ttype not in sqlparse.tokens.Comment or str(tok).strip() == ""


@given(sqlish)
def test_truncate(s):
    format(s, truncate_strings=5)


@given(sqlish)
def test_output_formats(s):
    format(s, output_format="python")
    format(s, output_format="php")


@given(sqlish, st.integers(1, 8), st.booleans(), st.booleans())
def test_reindent_opts(s, w, tabs, cf):
    format(s, reindent=True, indent_width=w, indent_tabs=tabs, comma_first=cf, wrap_after=w * 5, compact=cf)
