package org.apache.commons.codec.binary;

import java.nio.charset.*;
import java.util.*;
import org.apache.commons.codec.DecoderException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static byte[] bytes(List<Integer> l) { byte[] b = new byte[l.size()]; for (int i = 0; i < b.length; i++) b[i] = (byte) (int) l.get(i); return b; }
    static String ref(byte[] b, boolean lower) { StringBuilder sb = new StringBuilder(); for (byte x : b) sb.append(String.format(lower ? "%02x" : "%02X", x & 0xff)); return sb.toString(); }
    static byte[] dec(char[] c) { try { return Hex.decodeHex(c); } catch (DecoderException e) { throw new RuntimeException(e); } }
    static byte[] dec(Hex h, byte[] c) { try { return h.decode(c); } catch (DecoderException e) { throw new RuntimeException(e); } }
    static Object decO(Hex h, Object c) { try { return h.decode(c); } catch (DecoderException e) { throw new RuntimeException(e); } }

    @Test void roundTripAndRef() {
        qt().forAll(lists().of(integers().between(0, 255)).ofSizeBetween(0, 40)).checkAssert(l -> {
            byte[] b = bytes(l);
            assertEquals(ref(b, true), Hex.encodeHexString(b));
            assertEquals(ref(b, true), new String(Hex.encodeHex(b)));
            assertArrayEquals(b, dec(Hex.encodeHex(b)));
            assertArrayEquals(b, dec(ref(b, false).toCharArray()));
            Hex h = new Hex();
            assertArrayEquals(b, dec(h, h.encode(b)));
            assertEquals(2 * b.length, h.encode(b).length);
        });
    }
    @Test void charsets() {
        for (String cs : new String[]{"UTF-8", "UTF-16", "UTF-16LE", "UTF-16BE", "UTF-32", "ISO-8859-1", "US-ASCII"}) {
            Hex h = new Hex(Charset.forName(cs));
            qt().forAll(lists().of(integers().between(0, 255)).ofSizeBetween(0, 20)).checkAssert(l -> {
                byte[] b = bytes(l);
                assertArrayEquals(b, dec(h, h.encode(b)), cs);
                assertArrayEquals(b, (byte[]) decO(h, h.encode(b)), cs);
            });
        }
    }
    @Test void invalid() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 10)).checkAssert(s -> {
            boolean ok = s.length() % 2 == 0 && s.matches("[0-9a-fA-F]*");
            try { Hex.decodeHex(s.toCharArray()); assertTrue(ok, s); }
            catch (DecoderException e) { assertFalse(ok, s); }
        });
    }
    @Test void toStr() {
        assertTrue(new Hex().toString().endsWith("[charsetName=UTF-8]"));
    }
}
