import os, sys, types, struct, tempfile
_v = types.ModuleType("humanize._version"); _v.__version__ = "0"
sys.modules.setdefault("humanize._version", _v)
from hypothesis import given, settings, strategies as st
from humanize import i18n
from humanize.i18n import activate, deactivate, thousands_separator, decimal_separator

LOCALES = sorted(os.listdir(os.path.join(os.path.dirname(i18n.__file__), "locale")))

_ROOT = tempfile.mkdtemp()
for _l in LOCALES:
    _d = os.path.join(_ROOT, _l, "LC_MESSAGES")
    os.makedirs(_d)
    with open(os.path.join(_d, "humanize.mo"), "wb") as f:
        f.write(struct.pack("<7I", 0x950412DE, 0, 0, 28, 28, 0, 28))


@given(st.sampled_from(LOCALES))
def test_activate_sets_and_deactivate_resets(loc):
    t = activate(loc, _ROOT)
    assert i18n.get_translation() is t
    deactivate()
    assert thousands_separator() == "," and decimal_separator() == "."


@given(st.sampled_from(LOCALES))
def test_separators_distinct_and_single(loc):
    activate(loc, _ROOT)
    try:
        assert thousands_separator() != decimal_separator()
        assert len(thousands_separator()) == 1 and len(decimal_separator()) == 1
    finally:
        deactivate()


@given(st.sampled_from([None, "en", "en_GB", "en_US"]))
def test_english_is_null(loc):
    activate("de_DE", _ROOT)
    t = activate(loc)
    assert type(t).__name__ == "NullTranslations"
    assert thousands_separator() == ","
    assert decimal_separator() == "."


@given(st.sampled_from(LOCALES))
def test_activate_idempotent(loc):
    assert activate(loc, _ROOT) is activate(loc, _ROOT)
    deactivate()


@given(st.text(alphabet="abcxyz", min_size=3, max_size=6))
def test_missing_locale_raises_and_keeps_state(loc):
    activate("de_DE", _ROOT)
    with tempfile.TemporaryDirectory() as d:
        try:
            activate(loc, d)
        except FileNotFoundError:
            pass
    assert thousands_separator() == "."
    deactivate()


@given(st.sampled_from(LOCALES))
def test_activate_uses_given_path(loc):
    # a different path with a missing locale must not silently succeed via cache
    activate(loc, _ROOT)
    with tempfile.TemporaryDirectory() as d:
        try:
            activate(loc, d)
        except FileNotFoundError:
            return
        raise AssertionError("activate ignored the given path")
