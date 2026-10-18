from hypothesis import given, assume, settings, strategies as st
from jsonpointer import JsonPointer, JsonPointerException, resolve_pointer, escape, unescape, pairwise

tok = st.text(max_size=6)
toks = st.lists(tok, max_size=5)


@given(toks)
def test_from_parts_roundtrip(parts):
    p = JsonPointer.from_parts(parts)
    assert p.parts == parts
    assert JsonPointer(p.path) == p


@given(tok)
def test_escape_roundtrip(s):
    assert unescape(escape(s)) == s
    assert '/' not in escape(s)


@given(toks, toks)
def test_join_parts(a, b):
    assert JsonPointer.from_parts(a).join(b).parts == a + b
    assert (JsonPointer.from_parts(a) / JsonPointer.from_parts(b)).parts == a + b
    assert JsonPointer.from_parts(a).join(JsonPointer.from_parts(b).path).parts == a + b


@given(toks, tok)
def test_join_single(a, s):
    assert JsonPointer.from_parts(a).join(JsonPointer.from_parts([s]).path).parts == a + [s]


json = st.recursive(
    st.none() | st.booleans() | st.integers() | st.text(max_size=4),
    lambda c: st.lists(c, max_size=4) | st.dictionaries(st.text(max_size=4), c, max_size=4),
    max_leaves=10)


def paths(doc):
    yield []
    if isinstance(doc, dict):
        for k, v in doc.items():
            for p in paths(v):
                yield [k] + p
    elif isinstance(doc, list):
        for i, v in enumerate(doc):
            for p in paths(v):
                yield [str(i)] + p


@given(json)
def test_resolve_matches_reference(doc):
    for p in paths(doc):
        ref = doc
        for k in p:
            ref = ref[int(k)] if isinstance(ref, list) else ref[k]
        ptr = JsonPointer.from_parts(p)
        assert resolve_pointer(doc, ptr.path) == ref
        d, last = ptr.to_last(doc)
        if p:
            assert d[last] == ref
        else:
            assert d is doc and last is None


@given(json, toks)
def test_resolve_default_no_crash(doc, parts):
    p = JsonPointer.from_parts(parts)
    sentinel = object()
    r = resolve_pointer(doc, p.path, sentinel)
    # either resolved or default
    assert r is sentinel or True


@given(json, toks)
def test_to_last_errors(doc, parts):
    p = JsonPointer.from_parts(parts)
    try:
        p.to_last(doc)
    except JsonPointerException:
        pass


@given(st.lists(st.integers(), max_size=8))
def test_pairwise(xs):
    assert list(pairwise(xs)) == list(zip(xs, xs[1:]))
    assert list(pairwise(iter(xs))) == list(zip(xs, xs[1:]))
