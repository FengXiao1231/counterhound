from hypothesis import given, assume, strategies as st
import sqlparse
from sqlparse import sql, tokens as T

SQLS = st.sampled_from([
    "select a, b from t where x = 1 -- c\n and y in (1,2)",
    "select case when a then 1 when b then 2 else 3 end from t",
    "/* c */ select  foo(a, b)  as x from  t",
    "case when a=1 then 'x' end",
    "select case a when 1 then 2 end",
    "  \n select 1",
])


def stmt(s):
    return sqlparse.parse(s)[0]


def all_lists(tl):
    yield tl
    for t in tl.tokens:
        if t.is_group:
            yield from all_lists(t)


def is_cm(t):
    return t.ttype in T.Comment or isinstance(t, sql.Comment)


@given(SQLS, st.booleans(), st.booleans(), st.data())
def test_token_prev_reference(s, ws, cm, data):
    for tl in all_lists(stmt(s)):
        n = len(tl.tokens)
        idx = data.draw(st.integers(0, n))
        exp = (None, None)
        for j in range(idx - 1, -1, -1):
            t = tl.tokens[j]
            if (ws and t.is_whitespace) or (cm and is_cm(t)):
                continue
            exp = (j, t)
            break
        assert tl.token_prev(idx, ws, cm) == exp


@given(SQLS, st.booleans(), st.booleans())
def test_token_next_prev_inverse(s, ws, cm):
    for tl in all_lists(stmt(s)):
        for i in range(len(tl.tokens)):
            j, t = tl.token_next(i, ws, cm)
            if j is not None:
                assert tl.token_prev(j, ws, cm)[0] == (
                    i if not ((ws and tl.tokens[i].is_whitespace) or (cm and is_cm(tl.tokens[i]))) else tl.token_prev(j, ws, cm)[0])


@given(SQLS, st.booleans(), st.booleans())
def test_token_first(s, ws, cm):
    for tl in all_lists(stmt(s)):
        exp = None
        for t in tl.tokens:
            if (ws and t.is_whitespace) or (cm and is_cm(t)):
                continue
            exp = t
            break
        assert tl.token_first(ws, cm) is exp


@given(SQLS)
def test_has_ancestor(s):
    root = stmt(s)
    for tl in all_lists(root):
        for t in tl.tokens:
            assert t.has_ancestor(tl)
            assert t.has_ancestor(root) or t is root
            assert not t.has_ancestor(t)
            assert t.is_child_of(tl)
            assert tl.has_ancestor(t) is False


@given(SQLS)
def test_offset(s):
    root = stmt(s)
    flat = list(root.flatten())
    text = str(root)
    pos = 0
    for t in flat:
        for k in range(len(t.value)):
            assert root.get_token_at_offset(pos + k) is t
        pos += len(t.value)
    assert root.get_token_at_offset(len(text)) is None
    assert root.get_token_at_offset(-1) is None


@given(SQLS)
def test_token_index(s):
    for tl in all_lists(stmt(s)):
        for i, t in enumerate(tl.tokens):
            assert tl.token_index(t) == i
            assert tl.token_index(t, i) == i
            assert tl.token_index(t, tl.tokens[i]) == i


@given(SQLS, st.booleans())
def test_get_cases(s, ws):
    for tl in all_lists(stmt(s)):
        if isinstance(tl, sql.Case):
            cases = tl.get_cases(skip_ws=ws)
            for c, v in cases:
                if c is not None:
                    assert all(isinstance(x, sql.Token) for x in c)
                if ws:
                    assert not any(x.is_whitespace for x in (c or []) + v)
            conds = [c for c, _ in cases]
            assert all(c is not None for c in conds[:-1]) or True
            # only the last case may be ELSE
            assert all(c is not None for c in conds[:-1])
