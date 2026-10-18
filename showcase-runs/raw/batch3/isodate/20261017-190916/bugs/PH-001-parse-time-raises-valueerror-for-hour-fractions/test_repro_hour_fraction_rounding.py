from isodate.isotime import parse_time


def test_repro_hour_fraction_rounding():
    # 10.99999999999999 hours is just under 11:00:00; must not raise
    t = parse_time("10.99999999999999")
    assert t.hour in (10, 11)
