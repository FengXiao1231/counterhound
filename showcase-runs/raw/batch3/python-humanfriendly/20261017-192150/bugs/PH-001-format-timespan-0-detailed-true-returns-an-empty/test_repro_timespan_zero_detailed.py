from humanfriendly import format_timespan


def test_repro_timespan_zero_detailed():
    assert format_timespan(0) == '0 seconds'
    assert format_timespan(0, detailed=True) != ''
