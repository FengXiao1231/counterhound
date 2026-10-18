from hypothesis import given, strategies as st
from isodate.isotime import parse_time

@given(st.integers(0, 23), st.integers(13, 20), st.sampled_from([".", ","]))
def test_hour_fraction_nines(hh, n, s):
    parse_time("%02d%s%s" % (hh, s, "9" * n))
