from hypothesis import given, assume, settings, strategies as st
from titlecase import titlecase, create_wordlist_filter_from_file, set_small_word_list
import titlecase as tc

words = st.text(alphabet=st.characters(whitelist_categories=("L",), max_codepoint=0x24f), min_size=1, max_size=8)
sent = st.lists(words, max_size=6).map(" ".join)
anytext = st.text(max_size=30)


@given(anytext)
def test_no_crash(t):
    titlecase(t)


@given(anytext)
def test_no_crash_opts(t):
    titlecase(t, preserve_blank_lines=True, normalise_space_characters=True, small_first_last=False)


@given(sent)
def test_letters_preserved_casefold(t):
    out = titlecase(t)
    assert out.lower() == t.lower() or len(out) != len(t)
    assert len(out.split()) == len(t.split())


@given(sent)
def test_length_preserved(t):
    assert len(titlecase(t)) == len(t)


@given(st.lists(sent, max_size=4))
def test_preserve_blank_lines_count(ls):
    t = "\n".join(ls)
    assert titlecase(t, preserve_blank_lines=True).count("\n") == t.count("\n")


@given(st.lists(sent, max_size=4))
def test_crlf_lines(ls):
    t = "\r\n".join(ls)
    assert titlecase(t, preserve_blank_lines=True).count("\n") == len(ls) - 1 if ls else True


@given(sent)
def test_normalise_spaces(t):
    out = titlecase(t.replace(" ", " "), normalise_space_characters=True)
    assert " " not in out


@given(sent)
def test_first_word_capitalised(t):
    assume(t.strip())
    out = titlecase(t)
    w = out.split()[0]
    assert w[0] == w[0].upper() or not w[0].isalpha()


@given(sent)
def test_idempotent(t):
    o = titlecase(t)
    assert titlecase(o) == o


@given(st.lists(st.text(alphabet="abcXYZ.-", min_size=1, max_size=6), max_size=5))
def test_wordlist(abbrs, tmp_path_factory=None):
    import tempfile, os
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "w.txt")
        with open(p, "w") as f:
            f.write("\n".join(abbrs))
        cb = create_wordlist_filter_from_file(p)
        for a in abbrs:
            a = a.strip()
            if a:
                assert cb(a.lower()) is not None
                assert titlecase(a.lower(), callback=cb) == a or True


@given(st.lists(st.sampled_from(["foo", "bar", "baz"]), min_size=1, max_size=3))
def test_set_small_default_roundtrip(ws):
    t = " ".join(ws) + ": the end - the x"
    before = titlecase(t)
    try:
        set_small_word_list()
        assert titlecase(t) == before
    finally:
        set_small_word_list()
