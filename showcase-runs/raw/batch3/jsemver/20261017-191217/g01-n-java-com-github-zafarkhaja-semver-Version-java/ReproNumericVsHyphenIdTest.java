package com.github.zafarkhaja.semver;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproNumericVsHyphenIdTest {
    @Test
    void numericIdentifierHasLowerPrecedenceThanAlphanumeric() {
        Version num = Version.parse("1.0.0-1");
        Version alpha = Version.parse("1.0.0--a");
        assertTrue(num.compareToIgnoreBuildMetadata(alpha) < 0);
        assertTrue(alpha.compareToIgnoreBuildMetadata(num) > 0);
    }
}
