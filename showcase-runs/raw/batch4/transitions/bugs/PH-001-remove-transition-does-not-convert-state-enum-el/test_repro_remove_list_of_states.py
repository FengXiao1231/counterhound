from transitions import Machine


def test_repro_remove_transition_list_of_state_objects():
    m = Machine(states=['A', 'B', 'C'], initial='A', auto_transitions=False)
    m.add_transition('go', 'A', 'B')
    m.add_transition('go', 'B', 'C')
    m.remove_transition('go', source=[m.get_state('A')])
    assert [(t.source, t.dest) for t in m.get_transitions('go')] == [('B', 'C')]
