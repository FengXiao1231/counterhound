from hypothesis import given, assume, settings, strategies as st
from tabulate import tabulate, simple_separated_format

cell = st.text(alphabet=st.characters(whitelist_categories=("L", "N"), max_codepoint=0x7f), min_size=1, max_size=6)
sep = st.text(alphabet=st.characters(blacklist_categories=("Cs", "Cc")), min_size=1, max_size=3)
rows = st.lists(st.lists(cell, min_size=2, max_size=2), min_size=1, max_size=5)


@given(rows, sep)
def test_simple_sep_columns(r, s):
    out = tabulate(r, tablefmt=simple_separated_format(s), disable_numparse=True)
    lines = out.split("\n")
    assert len(lines) == len(r)
    for line, row in zip(lines, r):
        assert line.count(s) >= 1
        assert line.startswith(row[0])
        assert line.endswith(row[1].ljust(len(row[1])))


@given(rows)
def test_line_count_plain(r):
    out = tabulate(r, tablefmt="plain", disable_numparse=True)
    assert len(out.split("\n")) == len(r)


@given(rows)
def test_headers_firstrow(r):
    assume(len(r) > 1)
    a = tabulate(r[1:], headers=r[0], tablefmt="plain", disable_numparse=True)
    b = tabulate(r, headers="firstrow", tablefmt="plain", disable_numparse=True)
    assert a == b


@given(rows)
def test_all_cells_present(r):
    for fmt in ["simple", "grid", "pipe", "github", "orgtbl", "rounded_grid", "psql", "tsv", "html", "latex"]:
        out = tabulate(r, tablefmt=fmt, disable_numparse=True)
        for row in r:
            for c in row:
                assert c in out


@given(st.lists(st.lists(st.integers(-10**6, 10**6), min_size=2, max_size=3), min_size=1, max_size=5))
def test_ints_roundtrip(r):
    out = tabulate(r, tablefmt="plain")
    parsed = [[int(x) for x in l.split()] for l in out.split("\n")]
    assert parsed == [list(x) + [] for x in r] or all(len(a) == len(b) for a, b in zip(parsed, r))
    assert parsed == r if all(len(x) == len(r[0]) for x in r) else True


@given(rows)
def test_widths_equal_grid(r):
    out = tabulate(r, tablefmt="grid", disable_numparse=True)
    assert len({len(l) for l in out.split("\n")}) == 1
