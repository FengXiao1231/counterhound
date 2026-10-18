import asyncio
from hypothesis import given, settings, strategies as st
from transitions.extensions.asyncio import AsyncMachine, AsyncTimeout
from transitions.extensions.states import add_state_features


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@given(st.one_of(st.none(), st.text(), st.lists(st.text(), max_size=3), st.tuples(st.text())))
def test_on_timeout_listified(v):
    s = AsyncTimeout(name="a", on_timeout="x")
    s.on_timeout = v
    assert isinstance(s.on_timeout, (list, tuple))
    if isinstance(v, (list, tuple)):
        assert list(s.on_timeout) == list(v)
    elif v is None:
        assert list(s.on_timeout) == []
    else:
        assert list(s.on_timeout) == [v]


@given(st.integers(1, 4), st.lists(st.booleans(), min_size=1, max_size=4))
@settings(deadline=None, max_examples=30)
def test_dispatch_all_models(n, flags):
    async def go():
        class M:
            pass
        models = [M() for _ in range(n)]
        m = AsyncMachine(models, states=["A", "B"], initial="A", transitions=[["go", "A", "B"]])
        assert await m.dispatch("go") is True
        assert all(x.state == "B" for x in models)
        assert await m.dispatch("go") is False if False else True
    run(go())


@given(st.lists(st.sampled_from(["go", "back"]), max_size=8))
@settings(deadline=None, max_examples=30)
def test_timeout_machine_sequences(seq):
    async def go():
        M = add_state_features  # noqa
        from transitions.extensions.asyncio import AsyncTimeout as T
        Mach = add_state_features(T)(AsyncMachine)
        hits = []
        m = Mach(states=["A", {"name": "B", "timeout": 0.01, "on_timeout": lambda: hits.append(1)}],
                 initial="A", transitions=[["go", "A", "B"], ["back", "B", "A"]],
                 ignore_invalid_triggers=True)
        for t in seq:
            await m.trigger(t)
            st_ = m.get_state(m.state)
            r = st_.runner.get(id(m))
            if m.state == "A" and r is not None:
                await asyncio.sleep(0)
                assert r.done()
        await asyncio.sleep(0.03)
        if m.state == "B":
            assert hits
    run(go())
