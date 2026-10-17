package com.example.textkit;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Small text and list helpers.
 *
 * <p>This is a proofhound test fixture: several methods contain planted bugs.
 */
public final class TextKit {
    private TextKit() {}

    /**
     * Splits {@code xs} into consecutive chunks of length {@code n}. The last chunk may be
     * shorter. Concatenating the chunks gives back {@code xs}.
     *
     * @throws IllegalArgumentException if {@code n} is not positive
     */
    public static List<List<Integer>> chunk(List<Integer> xs, int n) {
        if (n <= 0) {
            throw new IllegalArgumentException("chunk size must be positive");
        }
        List<List<Integer>> out = new ArrayList<>();
        for (int i = 0; i + n <= xs.size(); i += n) { // BUG: drops the final partial chunk
            out.add(new ArrayList<>(xs.subList(i, i + n)));
        }
        return out;
    }

    /** Returns {@code s} with its code points in reverse order. */
    public static String reverse(String s) {
        return new StringBuilder(s).reverse().toString();
    }

    /** Returns the median of {@code xs}, or 0 for an empty array. */
    public static double median(double[] xs) {
        double[] s = xs.clone();
        Arrays.sort(s);
        int n = s.length;
        if (n % 2 == 1) {
            return s[n / 2];
        }
        return (s[n / 2 - 1] + s[n / 2]) / 2; // BUG: throws on empty input
    }

    /** Run-length encodes {@code s} as count+letter pairs, e.g. "aaab" -> "3a1b". {@code s} must be letters only. */
    public static String encodeRle(String s) {
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < s.length()) {
            int j = i;
            while (j < s.length() && s.charAt(j) == s.charAt(i)) {
                j++;
            }
            sb.append(j - i).append(s.charAt(i));
            i = j;
        }
        return sb.toString();
    }

    /** Decodes the output of {@link #encodeRle}. */
    public static String decodeRle(String s) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i + 1 < s.length(); i += 2) { // BUG: assumes single-digit counts
            int n = s.charAt(i) - '0';
            sb.append(String.valueOf(s.charAt(i + 1)).repeat(Math.max(0, n)));
        }
        return sb.toString();
    }

    /**
     * Returns the average of {@code a} and {@code b}, rounded toward negative infinity.
     * Works for all int values.
     */
    public static int midpoint(int a, int b) {
        return (a + b) / 2; // BUG: overflows, and rounds toward zero for negatives
    }

    /**
     * Parses a percentage between 0 and 100 inclusive, such as "42" or "42%".
     *
     * @throws IllegalArgumentException for anything else; that is intended
     */
    public static int parsePercent(String s) {
        String t = s.endsWith("%") ? s.substring(0, s.length() - 1) : s;
        int v;
        try {
            v = Integer.parseInt(t);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("not a percentage: " + s);
        }
        if (v < 0 || v > 100) {
            throw new IllegalArgumentException("out of range: " + s);
        }
        return v;
    }
}
