from furl.furl import Path


def test_repro_path_load_mutates_source():
    src = Path('/')
    before = (str(src), list(src.segments))
    Path().load(src)
    assert (str(src), src.segments) == before
