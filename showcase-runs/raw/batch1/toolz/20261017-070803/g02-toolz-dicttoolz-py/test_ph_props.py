from collections import OrderedDict
from hypothesis import given, assume, strategies as st
from toolz.dicttoolz import (merge_with, update_in, dissoc, itemfilter, keymap,
                             valmap, assoc_in, get_in)

keys = st.one_of(st.integers(-5, 5), st.text(max_size=3))
ints = st.integers(-100, 100)
dicts = st.dictionaries(keys, ints, max_size=8)


def deep(d):
    return {k: deep(v) if isinstance(v, dict) else v for k, v in d.items()}


@given(st.lists(dicts, max_size=5))
def test_merge_with_reference(ds):
    ref = {}
    for d in ds:
        for k, v in d.items():
            ref.setdefault(k, []).append(v)
    assert merge_with(list, *ds) == ref
    assert merge_with(list, ds) == ref
    assert merge_with(sum, *ds) == {k: sum(v) for k, v in ref.items()}


@given(st.lists(dicts, min_size=1, max_size=4))
def test_merge_with_factory(ds):
    r = merge_with(len, *ds, factory=OrderedDict)
    assert isinstance(r, OrderedDict)


@given(dicts, st.lists(keys, min_size=1, max_size=4), ints, ints)
def test_update_in_reference(d, ks, default, delta):
    orig = deep(d)
    cur0 = d
    for k in ks[:-1]:
        if k in cur0:
            assume(isinstance(cur0[k], dict))
            cur0 = cur0[k]
        else:
            break
    r = update_in(d, ks, lambda x: x + delta if isinstance(x, int) else ("f", x), default)
    assert d == orig
    # reference
    cur = r
    for k in ks:
        assert isinstance(cur, dict) and k in cur
        cur = cur[k]
    try:
        old = get_in(ks, d, no_default=True)
        exists = True
    except (KeyError, TypeError, IndexError):
        exists = False
    if exists:
        assert cur == (old + delta if isinstance(old, int) else ("f", old))
    else:
        assert cur == default + delta


@given(dicts, st.lists(keys, min_size=1, max_size=3), ints)
def test_update_in_no_mutation_nested(d, ks, v):
    nested = {"a": {"b": dict(d)}}
    snap = deep(nested)
    update_in(nested, ["a", "b"] + ks[:1], lambda x: v, 0)
    assert nested == snap


@given(dicts, st.lists(keys, max_size=12))
def test_dissoc(d, ks):
    orig = dict(d)
    r = dissoc(d, *ks)
    assert d == orig
    assert r == {k: v for k, v in d.items() if k not in ks}
    r2 = dissoc(d, *ks, factory=OrderedDict)
    assert isinstance(r2, OrderedDict) and r2 == r


@given(dicts)
def test_itemfilter(d):
    p = lambda kv: kv[1] % 2 == 0
    assert itemfilter(p, d) == {k: v for k, v in d.items() if p((k, v))}


@given(dicts)
def test_keymap_valmap(d):
    assert valmap(lambda x: x + 1, d) == {k: v + 1 for k, v in d.items()}
    assert keymap(lambda x: (x,), d) == {(k,): v for k, v in d.items()}
    assert valmap(lambda x: x, d) == d
    assert keymap(lambda x: x, d) == d
    assert list(valmap(lambda x: x, d)) == list(d)
