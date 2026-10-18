import html
import re
from hypothesis import given, assume, strategies as st
from markupsafe import escape, Markup, escape_silent


def ref_escape(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("'", "&#39;").replace('"', "&#34;"))


@given(st.text())
def test_escape_reference(s):
    r = escape(s)
    assert type(r) is Markup
    assert str(r) == ref_escape(s)


@given(st.text())
def test_escape_roundtrip(s):
    assert Markup(escape(s)).unescape() == s


@given(st.text())
def test_escape_no_special(s):
    r = str(escape(s))
    assert "<" not in r and ">" not in r and '"' not in r and "'" not in r


@given(st.text())
def test_escape_idempotent_on_markup(s):
    e = escape(s)
    assert escape(e) == e


@given(st.text())
def test_classmethod_and_silent(s):
    assert Markup.escape(s) == escape(s)
    assert escape_silent(s) == escape(s)
    assert escape_silent(None) == Markup("")

    class M(Markup):
        pass
    assert type(M.escape(s)) is M
    assert type(M.escape(Markup(s))) is M


@given(st.integers() | st.floats(allow_nan=False) | st.booleans())
def test_escape_nonstr(x):
    assert escape(x) == ref_escape(str(x))


@given(st.text())
def test_unescape_matches_html(s):
    assert Markup(s).unescape() == html.unescape(s)


def ref_strip(s):
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"<[^>]*>", "", s)
    return html.unescape(" ".join(s.split()))


@given(st.text(alphabet="ab <>!-&;\n\t", max_size=20))
def test_striptags_ref(s):
    # reference differs for odd comment cases; only compare when no '<!--'
    assume("<!--" not in s)
    assert Markup(s).striptags() == ref_strip(s)


@given(st.text(alphabet="ab <>!-&;\n\t", max_size=20))
def test_striptags_no_ws_runs(s):
    r = Markup(s).striptags()
    assert "  " not in r and r == r.strip()


@given(st.text(), st.one_of(st.none(), st.text(min_size=1, max_size=3)), st.integers(-2, 5))
def test_split(s, sep, n):
    m = Markup(s)
    assert [str(x) for x in m.split(sep, n)] == s.split(sep, n)
    assert [str(x) for x in m.rsplit(sep, n)] == s.rsplit(sep, n)
    assert all(type(x) is Markup for x in m.split(sep, n))


@given(st.text(), st.booleans())
def test_splitlines(s, k):
    assert [str(x) for x in Markup(s).splitlines(k)] == s.splitlines(k)
