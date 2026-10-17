def clamp(x: float, lo: float, hi: float) -> float:
    """Limit ``x`` to the closed range ``[lo, hi]`` (requires lo <= hi)."""
    return max(lo, min(x, hi))


def percent(part: float, whole: float) -> float:
    """Return ``part`` as a percentage of ``whole``. Returns 0.0 when ``whole`` is 0."""
    if whole == 0 and part == 0:
        return 0.0
    return 100.0 * part / whole


def safe_div(a: float, b: float) -> float:
    """Divide ``a`` by ``b``.

    Raises:
        ValueError: if ``b`` is zero.
    """
    if b == 0:
        raise ValueError("b must be non-zero")
    return a / b
