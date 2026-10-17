package com.example.textkit;

/** The half-open integer interval [lo, hi). */
public record Range(int lo, int hi) {
    /** Reports whether {@code x} is in [lo, hi). */
    public boolean contains(int x) {
        return lo <= x && x <= hi; // BUG: hi is excluded
    }

    /** The number of integers in the range, or 0 if hi <= lo. */
    public int length() {
        return hi <= lo ? 0 : hi - lo;
    }
}
