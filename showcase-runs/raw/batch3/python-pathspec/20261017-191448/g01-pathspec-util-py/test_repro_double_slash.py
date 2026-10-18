from pathspec.util import normalize_file


def test_repro_double_slash():
    assert not normalize_file("//a").startswith("/")
