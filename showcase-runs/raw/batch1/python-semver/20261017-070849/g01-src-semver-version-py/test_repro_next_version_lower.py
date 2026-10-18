from semver.version import Version


def test_repro_next_version_lower():
    v = Version.parse("1.0.0-rc.1")
    n = v.next_version("prerelease", "alpha")
    assert n > v, f"{n} is not newer than {v}"
