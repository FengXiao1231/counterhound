from hypothesis import given, strategies as st
from transitions import Machine

S = ['A', 'B', 'C', 'D']


@given(st.lists(st.tuples(st.sampled_from(S), st.sampled_from(S)), min_size=1, max_size=6),
       st.lists(st.sampled_from(S), min_size=1, max_size=3), st.booleans())
def test_remove_by_source_list(trs, srcs, use_state):
    m = Machine(states=S, initial='A', auto_transitions=False)
    for s, d in trs:
        m.add_transition('go', s, d)
    arg = [m.get_state(s) for s in srcs] if use_state else srcs
    m.remove_transition('go', source=arg)
    expected = sorted((s, d) for s, d in trs if s not in srcs)
    got = sorted((t.source, t.dest) for t in m.get_transitions('go'))
    assert got == expected
    assert ('go' in m.events) == bool(expected)
    assert hasattr(m, 'go') == bool(expected)


@given(st.lists(st.sampled_from(S), min_size=1, max_size=3), st.booleans())
def test_remove_by_dest_list(dsts, use_state):
    m = Machine(states=S, initial='A', auto_transitions=False)
    for s in S:
        for d in S:
            m.add_transition('go', s, d)
    arg = [m.get_state(d) for d in dsts] if use_state else dsts
    m.remove_transition('go', dest=arg)
    assert all(t.dest not in dsts for t in m.get_transitions('go'))
    assert len(m.get_transitions('go')) == 16 - 4 * len(set(dsts))


@given(st.integers(1, 4))
def test_dispatch_and_is_state(n):
    class M:
        pass
    models = [M() for _ in range(n)]
    m = Machine(model=models, states=['A', 'B'], initial='A')
    assert m.dispatch('to_B') is True
    assert all(x.is_B() and not x.is_A() and m.is_state('B', x) for x in models)
