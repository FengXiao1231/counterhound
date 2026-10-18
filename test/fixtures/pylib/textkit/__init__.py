"""Small text and list utilities (fixture with planted bugs for counterhound's own tests)."""
from .lists import chunk, merge_intervals, median
from .codec import rle_encode, rle_decode
from .numbers import clamp, percent, safe_div

__all__ = ["chunk", "merge_intervals", "median", "rle_encode", "rle_decode", "clamp", "percent", "safe_div"]
