from boltons.statsutils import Stats


def test_repro_empty_hist():
    # empty Stats are supported elsewhere (default value); must not raise ZeroDivisionError
    out = Stats([]).format_histogram()
    assert isinstance(out, str)
