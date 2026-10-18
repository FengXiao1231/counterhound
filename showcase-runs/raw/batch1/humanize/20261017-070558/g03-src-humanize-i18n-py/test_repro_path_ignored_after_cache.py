import os, sys, types, struct, tempfile
_v = types.ModuleType("humanize._version"); _v.__version__ = "0"
sys.modules.setdefault("humanize._version", _v)
import pytest
from humanize.i18n import activate, deactivate


def test_repro_path_ignored_after_cache():
    root = tempfile.mkdtemp()
    d = os.path.join(root, "fr_FR", "LC_MESSAGES")
    os.makedirs(d)
    with open(os.path.join(d, "humanize.mo"), "wb") as f:
        f.write(struct.pack("<7I", 0x950412DE, 0, 0, 28, 28, 0, 28))
    empty = tempfile.mkdtemp()
    try:
        activate("fr_FR", root)
        # No fr_FR catalogue exists under `empty`: documented FileNotFoundError expected
        with pytest.raises(FileNotFoundError):
            activate("fr_FR", empty)
    finally:
        deactivate()
