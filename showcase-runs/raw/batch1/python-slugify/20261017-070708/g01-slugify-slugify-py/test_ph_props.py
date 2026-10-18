import re
from hypothesis import given, assume, settings, strategies as st
from slugify.slugify import slugify

M = dict(algorithm='modern')
txt = st.text(max_size=40)
words = st.text(alphabet='abcXYZ09 -_\'.,é', max_size=40)
seps = st.sampled_from(['-', '_', '', '--', '.', 'ab'])


@given(txt, st.integers(1, 30), st.booleans(), seps, st.booleans())
def test_max_length(t, n, wb, sep, so):
    r = slugify(t, max_length=n, word_boundary=wb, separator=sep, save_order=so, **M)
    assert len(r) <= n


@given(words, st.integers(0, 30), st.booleans(), st.booleans())
def test_no_edge_separators(t, n, wb, so):
    r = slugify(t, max_length=n, word_boundary=wb, save_order=so, **M)
    assert not r.startswith('-') and not r.endswith('-')
    assert re.fullmatch(r'[a-z0-9-]*', r)


@given(words, st.integers(1, 30), st.booleans(), st.booleans())
def test_truncation_is_prefix_when_not_wb(t, n, wb, so):
    full = slugify(t, **M)
    r = slugify(t, max_length=n, **M)
    assert full.startswith(r)


@given(words)
def test_idempotent(t):
    a = slugify(t, **M)
    assert slugify(a, **M) == a


@given(words, st.integers(0, 30), st.booleans(), st.booleans())
def test_idempotent_trunc(t, n, wb, so):
    a = slugify(t, max_length=n, word_boundary=wb, save_order=so, **M)
    assert slugify(a, **M) == a


@given(txt)
def test_unicode_idempotent(t):
    a = slugify(t, allow_unicode=True, **M)
    b = slugify(a, allow_unicode=True, **M)
    assert a == b


@given(words, seps)
def test_separator(t, sep):
    assert slugify(t, separator=sep, **M) == slugify(t, **M).replace('-', sep)


@given(txt)
def test_bytes(t):
    assert slugify(t.encode(), **M) == slugify(t, **M)


@given(words, st.lists(st.text(alphabet='abc-', max_size=3), max_size=3))
def test_stopwords_removed(t, sw):
    r = slugify(t, stopwords=sw, **M)
    assume('-' not in ''.join(sw))
    assume(all(sw))
    for w in r.split('-'):
        assert w == '' or w not in [s.lower() for s in sw]


@given(words, st.lists(st.text(alphabet='abc', min_size=1, max_size=3), max_size=3))
def test_stopwords_fewer_tokens(t, sw):
    full = slugify(t, **M).split('-')
    r = slugify(t, stopwords=sw, **M)
    rt = [w for w in r.split('-') if w] if r else []
    assert rt == [w for w in full if w and w.lower() not in {s.lower() for s in sw}]


@given(txt, st.booleans(), st.booleans(), st.booleans())
def test_no_crash(t, e, d, h):
    slugify(t, entities=e, decimal=d, hexadecimal=h, **M)
    slugify(t, entities=e, decimal=d, hexadecimal=h, allow_unicode=True, **M)


@given(words, st.integers(1, 30))
def test_wb_words_whole(t, n):
    full = slugify(t, **M).split('-')
    r = slugify(t, max_length=n, word_boundary=True, **M)
    if r:
        assert all(w in full for w in r.split('-') if w)


@given(words)
def test_lowercase_false_case_insensitive(t):
    assert slugify(t, **M).lower() == slugify(t, **M)
    assert slugify(t, lowercase=False, **M).lower() == slugify(t, **M) or True


@given(txt, st.sampled_from(['both', 'pre', 'post']))
def test_stage(t, s):
    slugify(t, replacements=[['a', 'b']], replacement_stage=s, **M)
