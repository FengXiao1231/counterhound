from hypothesis import given, strategies as st
from semver.version import Version


@given(st.sampled_from(["alpha", "beta", "rc", "dev"]), st.sampled_from(["alpha", "beta", "rc", "dev"]), st.integers(0, 9))
def test_next_prerelease_alpha_tokens(old, new, n):
    v = Version.parse(f"1.0.0-{old}.{n}")
    assert v.next_version("prerelease", new) > v


def test_simple():
    v = Version.parse("1.0.0-rc.1")
    assert v.next_version("prerelease", "alpha") > v
