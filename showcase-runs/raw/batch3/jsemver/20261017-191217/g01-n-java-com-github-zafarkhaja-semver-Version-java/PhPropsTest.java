package com.github.zafarkhaja.semver;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    @Test
    void incrementLastNumericId() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(1, 5).map(s -> s.replaceAll("[^A-Za-z]", "a")),
                integers().between(0, 1000))
            .checkAssert((a, n) -> {
                Version v = Version.parse("1.0.0-" + a + "." + n);
                assertEquals(Version.parse("1.0.0-" + a + "." + (n + 1)), v.nextPreReleaseVersion());
            });
    }

    @Test
    void numericLowerThanAlnum() {
        qt().forAll(integers().between(0, 1000), strings().ascii().ofLengthBetween(1, 4).map(s -> "-" + s.replaceAll("[^0-9A-Za-z-]", "x")))
            .checkAssert((n, a) -> assertTrue(Version.parse("1.0.0-" + n).compareToIgnoreBuildMetadata(Version.parse("1.0.0-" + a)) < 0));
    }

    @Test
    void nextVersionsGreater() {
        qt().forAll(integers().between(0, 1000), integers().between(0, 1000), integers().between(0, 1000))
            .checkAssert((a, b, c) -> {
                Version v = Version.of(a, b, c);
                assertEquals(Version.of(a + 1, 0, 0), v.nextMajorVersion());
                assertEquals(Version.of(a, b + 1, 0), v.nextMinorVersion());
                assertEquals(Version.of(a, b, c + 1), v.nextPatchVersion());
                assertEquals(Version.parse("" + (a + 1) + ".0.0-rc.1"), v.nextMajorVersion("rc", "1"));
            });
    }
}
