package org.apache.commons.text.lookup;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static final StringLookupFactory F = StringLookupFactory.INSTANCE;

    static org.quicktheories.core.Gen<String> uni() {
        return strings().basicLatinAlphabet().ofLengthBetween(0, 5)
            .zip(integers().between(128, 0x2000), (a, c) -> a + (char) (int) c + a);
    }

    @Test
    void base64RoundTrip() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 20))
            .checkAssert(s -> assertEquals(s, F.base64DecoderStringLookup().lookup(F.base64EncoderStringLookup().lookup(s))));
    }

    @Test
    void base64RoundTripUnicode() {
        qt().forAll(uni())
            .checkAssert(s -> assertEquals(s, F.base64DecoderStringLookup().lookup(F.base64EncoderStringLookup().lookup(s))));
    }

    @Test
    void urlRoundTrip() {
        qt().forAll(uni())
            .checkAssert(s -> assertEquals(s, F.urlDecoderStringLookup().lookup(F.urlEncoderStringLookup().lookup(s))));
    }

    @Test
    void xmlRoundTrip() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 20))
            .assuming(s -> s.chars().noneMatch(c -> c < 32))
            .checkAssert(s -> assertEquals(s, F.xmlDecoderStringLookup().lookup(F.xmlEncoderStringLookup().lookup(s))));
    }
}
