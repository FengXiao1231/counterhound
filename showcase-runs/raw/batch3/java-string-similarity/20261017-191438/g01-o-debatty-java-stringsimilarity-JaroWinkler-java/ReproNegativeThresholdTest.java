package info.debatty.java.stringsimilarity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproNegativeThresholdTest {
    @Test
    void negativeThresholdGivesJaro() {
        // Jaro("ab","ac") = (1/2 + 1/2 + 1) / 3 = 2/3
        assertEquals(2.0 / 3.0, new JaroWinkler(-1).similarity("ab", "ac"), 1e-9);
    }
}
