from hypothesis import given, strategies as st
from inflection import camelize


@given(st.text(alphabet="abc_", min_size=1))
def test_camelize_lower_is_upper_with_first_lowered(s):
    up = camelize(s, True)
    assert camelize(s, False) == up[:1].lower() + up[1:]


def test_empty_lower():
    camelize("", False)
