package com.github.zafarkhaja.semver;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproZeroIdIncrementTest {
    @Test
    void incrementsNumericZeroIdentifier() {
        assertEquals("1.0.0-alpha.1", Version.parse("1.0.0-alpha.0").nextPreReleaseVersion().toString());
    }
}
