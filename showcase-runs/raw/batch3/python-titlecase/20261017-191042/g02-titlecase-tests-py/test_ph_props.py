from hypothesis import given, assume, strategies as st
from titlecase import titlecase
from titlecase.tests import TestSymbols, TestCallback

words = st.text(alphabet=st.characters(whitelist_categories=('L',), max_codepoint=0x24f), min_size=1, max_size=8)


@given(st.text(max_size=20))
def test_atnt_returns_none_or_upper(w):
    r = TestSymbols.at_n_t(w)
    assert r is None or r == w.upper() == "AT&T"


@given(st.lists(words, min_size=1, max_size=6))
def test_atnt_noop_equals_plain(ws):
    s = " ".join(ws)
    assume("at&t" not in s.lower())
    assert titlecase(s, callback=TestSymbols.at_n_t) == titlecase(s)


@given(st.lists(st.sampled_from(["at&t", "AT&T", "At&T", "x", "foo", "bar"]), min_size=1, max_size=5),
       st.integers(0, 4))
def test_atnt_present(ws, i):
    ws = list(ws)
    ws.insert(min(i, len(ws)), "at&t")
    out = titlecase(" ".join(ws), callback=TestSymbols.at_n_t)
    assert "AT&T" in out.split()


@given(st.lists(st.sampled_from(["tcp", "udp", "Udp", "UDP", "wrapper", "and", "a"]), min_size=1, max_size=6))
def test_abbrev(ws):
    out = titlecase(" ".join(ws), callback=TestCallback.abbreviation).split()
    assert len(out) == len(ws)
    for w, o in zip(ws, out):
        if w.upper() in ("TCP", "UDP"):
            assert o == w.upper()


@given(st.lists(words, min_size=1, max_size=6))
def test_abbrev_noop(ws):
    s = " ".join(ws)
    assume(not any(w.upper() in ("TCP", "UDP") for w in ws))
    assert titlecase(s, callback=TestCallback.abbreviation) == titlecase(s)
