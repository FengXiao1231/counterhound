package info.debatty.java.stringsimilarity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static final LongestCommonSubsequence L = new LongestCommonSubsequence();

    static int ref(String a, String b) {
        int[][] c = new int[a.length() + 1][b.length() + 1];
        for (int i = a.length() - 1; i >= 0; i--)
            for (int j = b.length() - 1; j >= 0; j--)
                c[i][j] = a.charAt(i) == b.charAt(j) ? 1 + c[i + 1][j + 1] : Math.max(c[i + 1][j], c[i][j + 1]);
        return c[0][0];
    }

    @Test
    void matchesReference() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 12), strings().allPossible().ofLengthBetween(0, 12))
            .checkAssert((a, b) -> assertEquals(ref(a, b), L.length(a, b)));
    }

    @Test
    void smallAlphabetReference() {
        qt().forAll(strings().betweenCodePoints('a', 'c').ofLengthBetween(0, 15), strings().betweenCodePoints('a', 'c').ofLengthBetween(0, 15))
            .checkAssert((a, b) -> {
                assertEquals(ref(a, b), L.length(a, b));
                assertEquals(a.length() + b.length() - 2 * ref(a, b), L.distance(a, b), 0.0);
                assertEquals(L.distance(a, b), L.distance(b, a), 0.0);
                assertTrue(L.distance(a, b) >= Math.abs(a.length() - b.length()));
            });
    }

    @Test
    void identityAndEmpty() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 12)).checkAssert(a -> {
            assertEquals(0.0, L.distance(a, a), 0.0);
            assertEquals(a.length(), L.length(a, a));
            assertEquals(0, L.length(a, ""));
            assertEquals(a.length(), L.distance(a, ""), 0.0);
        });
    }

    @Test
    void nulls() {
        assertThrows(NullPointerException.class, () -> L.distance(null, "a"));
        assertThrows(NullPointerException.class, () -> L.distance("a", null));
        assertThrows(NullPointerException.class, () -> L.length(null, "a"));
        assertThrows(NullPointerException.class, () -> L.length("a", null));
    }
}
