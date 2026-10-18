from boltons.tbutils import TracebackInfo


def test_repro_from_dict():
    def f():
        raise ValueError('x')
    try:
        f()
    except ValueError:
        ti = TracebackInfo.from_traceback()
    d = ti.to_dict()
    ti2 = TracebackInfo.from_dict(d)
    assert ti2.to_dict() == d
    str(ti2)
