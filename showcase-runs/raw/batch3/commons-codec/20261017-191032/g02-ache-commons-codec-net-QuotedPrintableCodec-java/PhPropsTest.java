package org.apache.commons.codec.net;

import java.io.ByteArrayOutputStream;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static byte[] toBytes(List<Integer> l) {
        byte[] b = new byte[l.size()];
        for (int i = 0; i < b.length; i++) b[i] = (byte) (int) l.get(i);
        return b;
    }
    // bias toward spaces, tabs, CR, LF, '=' and printable
    static org.quicktheories.core.Gen<List<Integer>> bytesGen(int max) {
        return lists().of(integers().between(0, 255).mix(integers().between(32, 126), 50)
                .mix(arbitrary().pick(32, 9, 13, 10, 61), 40)).ofSizeBetween(3, max);
    }

    static byte[] dec(byte[] x) {
        try { return QuotedPrintableCodec.decodeQuotedPrintable(x); } catch (Exception e) { throw new RuntimeException(e); }
    }

    @Test
    void roundTripNonStrict() {
        qt().forAll(bytesGen(200)).checkAssert(l -> {
            byte[] b = toBytes(l);
            QuotedPrintableCodec c = new QuotedPrintableCodec(false);
            assertArrayEquals(b, dec(c.encode(b)));
        });
    }

    @Test
    void roundTripStrict() {
        qt().forAll(bytesGen(300)).assuming(l -> l.size() >= 3).checkAssert(l -> {
            byte[] b = toBytes(l);
            QuotedPrintableCodec c = new QuotedPrintableCodec(true);
            assertArrayEquals(b, dec(c.encode(b)));
        });
    }

    @Test
    void strictLineLength() {
        qt().forAll(bytesGen(300)).assuming(l -> l.size() >= 3).checkAssert(l -> {
            byte[] b = toBytes(l);
            byte[] e = new QuotedPrintableCodec(true).encode(b);
            String s = new String(e, java.nio.charset.StandardCharsets.US_ASCII);
            for (String line : s.split("\r\n", -1)) assertTrue(line.length() <= 76, line.length() + ": " + line);
        });
    }

    @Test
    void strictNoTrailingWhitespaceBeforeBreak() {
        qt().forAll(bytesGen(300)).assuming(l -> l.size() >= 3).checkAssert(l -> {
            byte[] b = toBytes(l);
            String s = new String(new QuotedPrintableCodec(true).encode(b), java.nio.charset.StandardCharsets.US_ASCII);
            assertFalse(s.endsWith(" ") || s.endsWith("\t"));
            assertFalse(s.contains(" =\r\n") || s.contains("\t=\r\n"), s);
        });
    }

    @Test
    void encodeOutputAscii() {
        qt().forAll(bytesGen(100)).checkAssert(l -> {
            byte[] e = new QuotedPrintableCodec(false).encode(toBytes(l));
            for (byte x : e) assertTrue(x >= 9 && x < 127);
        });
    }

    @Test
    void decodeNeverOtherException() {
        qt().forAll(bytesGen(30)).checkAssert(l -> {
            try {
                QuotedPrintableCodec.decodeQuotedPrintable(toBytes(l));
            } catch (org.apache.commons.codec.DecoderException e) {
            }
        });
    }

    @Test
    void customPrintable() {
        qt().forAll(bytesGen(60), lists().of(integers().between(0, 255)).ofSizeBetween(0, 100)).checkAssert((l, p) -> {
            BitSet bs = new BitSet();
            for (int x : p) if (x != 61) bs.set(x);
            byte[] b = toBytes(l);
            assertArrayEquals(b, dec(QuotedPrintableCodec.encodeQuotedPrintable(bs, b)));
        });
    }

    @Test
    void stringRoundTrip() throws Exception {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 30)).checkAssert(s -> {
            try {
                QuotedPrintableCodec c = new QuotedPrintableCodec(false);
                String r = c.decode(c.encode(s));
                if (!s.equals(r)) {
                    // lone surrogates can't roundtrip
                    assertNotEquals(s, new String(s.getBytes(java.nio.charset.StandardCharsets.UTF_8), java.nio.charset.StandardCharsets.UTF_8));
                }
            } catch (Exception e) { throw new RuntimeException(e); }
        });
    }
}
