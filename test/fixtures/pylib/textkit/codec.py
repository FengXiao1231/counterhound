def rle_encode(s: str) -> str:
    """Run-length encode a string of letters: ``"aaab"`` -> ``"3a1b"``.

    ``rle_decode(rle_encode(s)) == s`` for any string of letters.
    """
    if not s:
        return ""
    out = []
    prev, count = s[0], 1
    for ch in s[1:]:
        if ch == prev:
            count += 1
        else:
            out.append(f"{count}{prev}")
            prev, count = ch, 1
    out.append(f"{count}{prev}")
    return "".join(out)


def rle_decode(s: str) -> str:
    """Inverse of :func:`rle_encode`."""
    out = []
    for i in range(0, len(s), 2):
        out.append(s[i + 1] * int(s[i]))
    return "".join(out)
