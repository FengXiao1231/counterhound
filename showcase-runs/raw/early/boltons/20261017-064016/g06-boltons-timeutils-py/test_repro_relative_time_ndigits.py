from datetime import datetime, timedelta
from boltons.timeutils import relative_time


def test_repro_relative_time_ndigits():
    d = datetime(2000, 1, 1)
    other = d + timedelta(seconds=1, microseconds=123456)
    assert relative_time(d, other, ndigits=6) == '1.123456 seconds ago'
