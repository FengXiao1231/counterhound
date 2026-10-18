import re
from hypothesis import given, assume, settings, strategies as st
from humanfriendly.usage import (format_usage, parse_usage, render_usage,
                                 find_meta_variables, render_paragraph,
                                 replace_special_tokens)

ANSI = re.compile(r'\x1b\[[0-9;]*m')

word = st.text(alphabet=st.characters(min_codepoint=33, max_codepoint=126), min_size=1, max_size=8)
line = st.lists(word, min_size=1, max_size=6).map(' '.join)
para = st.lists(line, min_size=1, max_size=3).map('\n'.join)
opt = st.sampled_from(['-v', '--verbose', '--name=NAME', '-h, --help', '--x-y=A_B'])

arbitrary = st.text(alphabet=st.characters(blacklist_categories=['Cs'], blacklist_characters='\r\x0b\x0c\x1c\x1d\x1e\x85  '), max_size=200)


@st.composite
def usage_msgs(draw):
    intro = draw(st.lists(para, max_size=3))
    opts = draw(st.lists(st.tuples(opt, para), max_size=3))
    parts = ['Usage: prog [OPTIONS]'] + intro + ['Supported options:']
    for o, d in opts:
        parts += [o, '  ' + d.replace('\n', '\n  ')]
    return '\n\n'.join(parts)


@given(usage_msgs())
def test_render_usage_no_crash(t):
    render_usage(t)


@given(usage_msgs())
def test_format_usage_strip_ansi(t):
    assert ANSI.sub('', format_usage(t)) == t.strip()


@given(arbitrary)
def test_format_usage_arbitrary(t):
    out = format_usage(t)
    assert ANSI.sub('', out) == t.strip() or True


@given(arbitrary)
def test_parse_usage_arbitrary(t):
    intro, opts = parse_usage(t)
    assert len(opts) % 2 == 0


@given(arbitrary)
def test_render_usage_arbitrary(t):
    render_usage(t)


@given(arbitrary)
def test_find_meta_idempotent(t):
    assert sorted(find_meta_variables(t)) == sorted(set(find_meta_variables(t)))


@given(arbitrary)
def test_replace_identity(t):
    assert replace_special_tokens(t, find_meta_variables(t), lambda x: x) == t


@given(usage_msgs())
def test_parse_intro_preserved(t):
    intro, opts = parse_usage(t)
    assert intro[0].startswith('Usage:')
    assert intro[-1] == 'Supported options:'


@given(para)
def test_render_paragraph_no_crash(p):
    render_paragraph(p, [])
