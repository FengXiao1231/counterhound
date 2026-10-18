import os
import warnings
from hypothesis import given, assume, settings, strategies as st

from pathspec.util import normalize_file, normalize_files, check_match_file, detailed_match_files, match_files
from pathspec.patterns.gitwildmatch import GitWildMatchPattern

warnings.simplefilter("ignore")

paths = st.text(alphabet="ab./\\ ", min_size=0, max_size=12)


@given(paths)
def test_normalize_no_backslash(p):
    assert "\\" not in normalize_file(p, separators=["\\"])


@given(paths)
def test_normalize_not_leading_slash(p):
    r = normalize_file(p, separators=["\\", "/"])
    assert not r.startswith("/")


@given(paths)
def test_normalize_idempotent(p):
    r = normalize_file(p, separators=["\\"])
    assert normalize_file(r, separators=["\\"]) == r


@given(paths)
def test_normalize_empty_seps(p):
    r = normalize_file(p, separators=())
    assert r in (p, p[1:], p[2:])


@given(st.lists(paths, max_size=6))
def test_normalize_files_grouping(ps):
    d = normalize_files(ps, separators=["\\"])
    assert sorted(x for v in d.values() for x in v) == sorted(ps)
    for k, v in d.items():
        for x in v:
            assert normalize_file(x, separators=["\\"]) == k


pats = st.lists(
    st.tuples(st.sampled_from(["a", "b", "*.x", "!a", "!*.x", "a/", "#c", ""]),),
    max_size=5,
)
files = st.lists(st.sampled_from(["a", "b", "c.x", "a/b", "a/c.x", "d"]), max_size=6, unique=True)


def mk(ps):
    return [GitWildMatchPattern(p[0]) for p in ps]


@given(pats, files)
def test_match_files_agree_detailed(ps, fs):
    pl = mk(ps)
    assert set(detailed_match_files(pl, fs)) == match_files(pl, fs)


@given(pats, files, st.booleans())
def test_all_matches_keys_same(ps, fs, am):
    pl = mk(ps)
    assert set(detailed_match_files(pl, fs, am)) == set(detailed_match_files(pl, fs))


@given(pats, st.sampled_from(["a", "b", "c.x", "a/b", "d"]))
def test_check_match_reversed(ps, f):
    pl = mk(ps)
    idx = list(enumerate(pl))
    fwd = check_match_file(idx, f)
    rev = check_match_file(list(reversed(idx)), f, True)
    assert fwd == rev


@given(pats, files)
def test_detailed_last_pattern_matches_check(ps, fs):
    pl = mk(ps)
    idx = list(enumerate(pl))
    det = detailed_match_files(pl, fs)
    for f in fs:
        inc, i = check_match_file(idx, f)
        assert (f in det) == bool(inc)
        if inc:
            assert det[f].patterns[-1] is pl[i]


@given(pats, files)
def test_all_matches_nonempty_last(ps, fs):
    pl = mk(ps)
    idx = list(enumerate(pl))
    det = detailed_match_files(pl, fs, True)
    for f, d in det.items():
        inc, i = check_match_file(idx, f)
        assert d.patterns[-1] is pl[i]
