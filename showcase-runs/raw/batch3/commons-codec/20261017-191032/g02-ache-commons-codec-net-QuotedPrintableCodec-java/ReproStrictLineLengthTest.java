package org.apache.commons.codec.net;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproStrictLineLengthTest {
    @Test
    void lineWithSoftBreakMustNotExceed76() {
        byte[] in = new byte[74];
        Arrays.fill(in, (byte) 'a');
        in[70] = 0;
        in[71] = 0;
        String out = new String(new QuotedPrintableCodec(true).encode(in), StandardCharsets.US_ASCII);
        for (String line : out.split("\r\n", -1)) {
            assertTrue(line.length() <= 76, "line length " + line.length() + ": " + line);
        }
    }
}
