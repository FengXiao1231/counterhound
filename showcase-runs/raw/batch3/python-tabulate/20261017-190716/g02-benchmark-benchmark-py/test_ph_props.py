import contextlib
import io

from hypothesis import given, settings, strategies as st

from benchmark import benchmark as bm


@settings(max_examples=5, deadline=None)
@given(st.integers(min_value=1, max_value=3))
def test_benchmark_output(n):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        bm.benchmark(n)
    lines = buf.getvalue().strip().splitlines()
    rows = lines[3:-1]
    assert len(rows) == len(bm.methods)
    rels = [float(r.split()[-1]) for r in rows]
    assert rels == sorted(rels)
    assert rels[0] == 1.0
