from typing import List, Sequence, Tuple, TypeVar

T = TypeVar("T")


def chunk(xs: Sequence[T], size: int) -> List[List[T]]:
    """Split ``xs`` into consecutive chunks of length ``size``.

    The last chunk may be shorter. ``size`` must be positive.
    """
    if size <= 0:
        raise ValueError("size must be positive")
    return [list(xs[i:i + size]) for i in range(0, len(xs) - size + 1, size)]


def merge_intervals(intervals: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    """Merge overlapping or touching closed intervals ``(start, end)`` with start <= end.

    The result is sorted and no two intervals in it overlap or touch.
    """
    out: List[Tuple[int, int]] = []
    for start, end in sorted(intervals):
        if out and start < out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], end))
        else:
            out.append((start, end))
    return out


def median(xs: Sequence[float]) -> float:
    """Return the median of a non-empty sequence.

    For an even number of values this is the mean of the two middle values.
    """
    s = sorted(xs)
    return s[len(s) // 2]
