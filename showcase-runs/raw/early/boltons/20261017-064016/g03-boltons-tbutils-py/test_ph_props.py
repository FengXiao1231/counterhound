from hypothesis import given, assume, settings, strategies as st
from boltons.tbutils import ParsedException, TracebackInfo, format_exception_only

ident = st.from_regex(r'[A-Za-z_][A-Za-z0-9_]{0,8}', fullmatch=True)
path = st.from_regex(r'[A-Za-z0-9_/.]{1,12}', fullmatch=True)
src = st.from_regex(r'[A-Za-z0-9_=()+ ]{1,15}', fullmatch=True).map(str.strip).filter(bool)
msg = st.from_regex(r'[A-Za-z0-9 ]{1,15}', fullmatch=True).map(str.strip).filter(bool)

frame = st.fixed_dictionaries({'filepath': path, 'lineno': st.integers(1, 999).map(str),
                               'funcname': ident, 'source_line': src})


@given(st.lists(frame, max_size=4), ident, msg)
def test_parsed_roundtrip(frames, et, em):
    pe = ParsedException(et, em, frames)
    s = pe.to_string()
    p2 = ParsedException.from_string(s)
    assert p2.to_string() == s
    assert p2.frames == frames


def _f():
    raise ValueError('x')


def test_from_dict_roundtrip():
    try:
        _f()
    except ValueError:
        ti = TracebackInfo.from_traceback()
    ti2 = TracebackInfo.from_dict(ti.to_dict())
    assert ti2.to_dict() == ti.to_dict()
    str(ti2)


@given(st.integers(0, 6), st.integers(1, 6))
def test_limit(n, lim):
    ti = TracebackInfo.from_frame(limit=lim)
    assert len(ti) <= lim


@given(st.one_of(st.none(), st.integers(1, 50)), st.text(max_size=5))
def test_syntax_error_lineno(ln, m):
    e = SyntaxError(m)
    e.lineno = ln
    out = format_exception_only(SyntaxError, e)
    assert out[-1].endswith('\n')
    assert 'None' not in out[0]
