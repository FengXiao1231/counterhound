import sys, types
if "humanize._version" not in sys.modules:
    _m = types.ModuleType("humanize._version")
    _m.__version__ = "0"
    sys.modules["humanize._version"] = _m
from humanize.number import ordinal


def test_repro_ordinal_negative():
    assert ordinal(-1) == "-1st"
    assert ordinal(-2) == "-2nd"
    assert ordinal(-3) == "-3rd"
    assert ordinal(-21) == "-21st"
