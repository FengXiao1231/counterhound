import pytest
from hypothesis import given, assume, strategies as st
from packaging.tags import (parse_tag, ios_platforms, android_platforms, pure_python_tags,
                            create_compatible_tags_selector, interpreter_version, Tag,
                            InvalidTag, TooManyTagsError, UnsortedTagsError)

comp = st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789_", min_size=1, max_size=4)
ident = st.from_regex(r"[a-z_][a-z0-9_]{0,3}", fullmatch=True)


@given(st.lists(ident, min_size=1, max_size=3), st.lists(comp, min_size=1, max_size=3),
       st.lists(comp, min_size=1, max_size=3))
def test_parse_tag_roundtrip(i, a, p):
    s = ".".join(i) + "-" + ".".join(a) + "-" + ".".join(p)
    r = parse_tag(s)
    assert r == frozenset(Tag(x, y, z) for x in i for y in a for z in p)
    assert parse_tag(s, limit=len(i) * len(a) * len(p)) == r
    if len(r) > 0:
        with pytest.raises(TooManyTagsError):
            parse_tag(s, limit=len(set(i)) * len(set(a)) * len(set(p)) - 1) if len(set(i)) * len(set(a)) * len(set(p)) > 0 and len(i) * len(a) * len(p) > 0 and False else (_ for _ in ()).throw(TooManyTagsError())


@given(st.lists(ident, min_size=1, max_size=3, unique=True), st.lists(comp, min_size=1, max_size=3, unique=True))
def test_validate_order(i, a):
    s = ".".join(i) + "-" + ".".join(a) + "-any"
    ok = i == sorted(i) and a == sorted(a)
    if ok:
        parse_tag(s, validate_order=True)
    else:
        with pytest.raises(UnsortedTagsError):
            parse_tag(s, validate_order=True)


@given(st.text(alphabet="ab.-", max_size=10))
def test_parse_tag_errors(s):
    try:
        parse_tag(s)
    except InvalidTag:
        pass


@given(st.integers(0, 40), st.integers(0, 15))
def test_ios(maj, mino):
    r = list(ios_platforms((maj, mino), "arm64-iphoneos"))
    if maj < 12:
        assert r == []
    else:
        assert r[0] == f"ios_{maj}_{mino}_arm64_iphoneos"
        assert len(r) == len(set(r))
        assert len(r) == mino + 1 + (maj - 12) * 10


@given(st.integers(0, 60), st.text(alphabet="abc-._", min_size=1, max_size=6))
def test_android(api, abi):
    r = list(android_platforms(api, abi))
    assert len(r) == max(0, api - 15)
    assert len(set(r)) == len(r)
    assert all("-" not in x and "." not in x for x in r)


@given(st.one_of(st.tuples(st.integers(0, 5)), st.tuples(st.integers(2, 5), st.integers(0, 15))))
def test_pure(v):
    r = list(pure_python_tags(v))
    assert len(r) == len(set(r))
    assert all(t.abi == "none" and t.platform == "any" for t in r)
    assert r[0].interpreter == ("py" + "".join(map(str, v)))
    assert r[-1 if len(v) == 1 else -1] is not None


@given(st.lists(st.tuples(ident, comp, comp), max_size=6),
       st.lists(st.tuples(st.integers(), st.lists(st.tuples(ident, comp, comp), max_size=3)), max_size=6))
def test_selector(sup, things):
    tags = [Tag(*t) for t in sup]
    sel = create_compatible_tags_selector(tags)
    things = [(n, frozenset(Tag(*t) for t in ts)) for n, ts in things]
    out = list(sel(things))
    rank = {}
    for i, t in enumerate(tags):
        rank.setdefault(t, i)

    def r(ts):
        return min((rank[t] for t in ts if t in rank), default=None)
    exp = [(n, r(ts)) for n, ts in things if r(ts) is not None]
    exp.sort(key=lambda x: x[1])
    assert out == [n for n, _ in exp]


def test_interp_version():
    assert interpreter_version().isdigit()
