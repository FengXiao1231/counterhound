package org.apache.commons.text.lookup;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproBase64Utf8Test {
    @Test
    void roundTripNonLatin1() {
        String s = "€";
        StringLookupFactory f = StringLookupFactory.INSTANCE;
        assertEquals(s, f.base64DecoderStringLookup().lookup(f.base64EncoderStringLookup().lookup(s)));
    }
}
