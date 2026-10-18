from hypothesis import given, assume, settings, strategies as st
from slugify.slugify import slugify

M = dict(algorithm='modern')
words = st.text(alphabet='abcXYZ09 -_\'.,é&#;x', max_size=30)
seps = st.sampled_from(['-', '_', '', '--', 'ab'])
reps = st.lists(st.tuples(st.text(alphabet='abc-', min_size=1, max_size=2), st.text(alphabet='abc-_ ', max_size=3)), max_size=2)


@given(words, st.integers(1, 20), st.booleans(), seps, st.booleans(), reps, st.sampled_from(['both', 'pre', 'post']))
def test_max_length_reps(t, n, wb, sep, so, rp, st_):
    r = slugify(t, max_length=n, word_boundary=wb, separator=sep, save_order=so, replacements=rp, replacement_stage=st_, **M)
    assert len(r) <= n


@given(words, st.integers(1, 20), seps, st.booleans(), st.booleans())
def test_unicode_max(t, n, sep, wb, so):
    r = slugify(t, max_length=n, word_boundary=wb, separator=sep, save_order=so, allow_unicode=True, **M)
    assert len(r) <= n


@given(words, st.integers(1, 20), st.booleans())
def test_no_leading_sep(t, n, so):
    r = slugify(t, max_length=n, word_boundary=True, save_order=so, separator='_', **M)
    assert not r.startswith('_') and not r.endswith('_')


@given(words)
def test_case_stop(t):
    r = slugify(t, lowercase=False, stopwords=['A', 'b'], **M)
    assert 'A' not in r.split('-') and 'b' not in r.split('-')


@given(words, st.integers(0, 20))
def test_regex(t, n):
    r = slugify(t, regex_pattern=r'[^a-z]+', max_length=n, **M)
    assert all(c in 'abcdefghijklmnopqrstuvwxyz-' for c in r)


@given(words)
def test_entity_decoding_equiv(t):
    assert slugify('&amp;' + t, **M) == slugify('&' + t, **M)
    assert slugify('&#65;' + t, **M) == slugify('A' + t, **M)
    assert slugify('&#x41;' + t, **M) == slugify('A' + t, **M)
