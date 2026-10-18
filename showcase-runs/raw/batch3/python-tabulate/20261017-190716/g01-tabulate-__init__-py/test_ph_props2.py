from hypothesis import given, assume, settings, strategies as st
from tabulate import tabulate

word = st.text(alphabet="abcdefg hij-", min_size=1, max_size=30).filter(lambda s: s.strip() == s and s)
rows = st.lists(st.lists(word, min_size=1, max_size=3), min_size=1, max_size=4).filter(lambda r: len({len(x) for x in r}) == 1)


@given(rows, st.integers(1, 10))
def test_maxcolwidths(r, w):
    out = tabulate(r, tablefmt="plain", maxcolwidths=w, disable_numparse=True)
    for line in out.split("\n"):
        for part in line.split("  "):
            pass
    # words preserved (modulo breaking): all non-space characters kept
    assert "".join(out.split()).replace("\n", "") != ""
    src = "".join("".join(x) for x in r).replace(" ", "")
    assert sorted(out.replace(" ", "").replace("\n", "")) == sorted(src)


@given(rows, st.sampled_from(["left", "right", "center"]))
def test_align_preserves(r, a):
    out = tabulate(r, tablefmt="pipe", colglobalalign=a, disable_numparse=True)
    assert len({len(l) for l in out.split("\n")}) == 1


@given(st.lists(st.one_of(st.none(), st.integers(-1000, 1000)), min_size=1, max_size=5), st.text("xyz", max_size=3))
def test_missingval(c, mv):
    out = tabulate([[x] for x in c], missingval=mv, tablefmt="plain")
    assert len(out.split("\n")) == len(c)
    assert out.count("\n") == len(c) - 1


@given(rows)
def test_showindex(r):
    out = tabulate(r, tablefmt="plain", showindex=True, disable_numparse=True)
    lines = out.split("\n")
    assert len(lines) == len(r)
    for i, l in enumerate(lines):
        assert l.split()[0] == str(i)


@given(st.lists(st.floats(-1e6, 1e6, allow_nan=False), min_size=1, max_size=5), st.integers(0, 6))
def test_floatfmt(c, n):
    out = tabulate([[x] for x in c], floatfmt=f".{n}f", tablefmt="plain")
    for l, x in zip(out.split("\n"), c):
        assert float(l) == float(f"{x:.{n}f}")


@given(rows, st.sampled_from(["grid", "simple", "pipe", "plain", "rst", "outline", "fancy_grid", "mixed_grid"]))
def test_headers_dict_and_keys(r, fmt):
    h = [f"h{i}" for i in range(len(r[0]))]
    a = tabulate(r, headers=h, tablefmt=fmt, disable_numparse=True)
    d = [dict(zip(h, row)) for row in r]
    b = tabulate(d, headers="keys", tablefmt=fmt, disable_numparse=True)
    assert a == b


@given(st.lists(st.text(alphabet="日本語ab", min_size=1, max_size=5), min_size=1, max_size=4))
def test_wide_grid(c):
    out = tabulate([[x] for x in c], tablefmt="grid")
    from wcwidth import wcswidth
    assert len({wcswidth(l) for l in out.split("\n")}) == 1
