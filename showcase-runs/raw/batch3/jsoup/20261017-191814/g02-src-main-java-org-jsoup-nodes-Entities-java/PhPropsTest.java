package org.jsoup.nodes;

import org.jsoup.nodes.Document.OutputSettings;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static String clean(String s) {
        StringBuilder sb = new StringBuilder();
        s.codePoints().filter(c -> !(c >= 0xD800 && c <= 0xDFFF)).filter(c -> c >= 0x20 || c == 9 || c == 10 || c == 13)
            .filter(c -> c != 0xFFFE && c != 0xFFFF).forEach(sb::appendCodePoint);
        return sb.toString();
    }
    static final String[] NAMES = {"lt","gt","amp","not","notin","notit","nbsp","NotSubset","fjlig","copy","copyx","zzz","","AMP","ampx"};

    @Test void roundTripUtf8() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 20)).checkAssert(s0 -> {
            String s = clean(s0);
            assertEquals(s, Entities.unescape(Entities.escape(s)));
        });
    }
    @Test void roundTripAllModes() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 20), arbitrary().pick(Entities.EscapeMode.values()),
            arbitrary().pick(StandardCharsets.US_ASCII, StandardCharsets.UTF_8, StandardCharsets.ISO_8859_1, StandardCharsets.UTF_16))
            .checkAssert((s0, m, cs) -> {
            String s = clean(s0);
            OutputSettings o = new OutputSettings().escapeMode(m).charset(cs);
            String e = Entities.escape(s, o);
            assertEquals(s, Entities.unescape(e), e);
        });
    }
    @Test void noRawSpecials() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 20)).checkAssert(s -> {
            String e = Entities.escape(s);
            assertFalse(e.contains("<") || e.contains(">") || e.contains("\"") || e.contains("'"), e);
            assertFalse(e.replaceAll("&(#x[0-9a-f]+|[A-Za-z0-9]+);", "").contains("&"), e);
        });
    }
    @Test void asciiOutputOnly() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 20)).checkAssert(s -> {
            String e = Entities.escape(clean(s), new OutputSettings().charset("ascii"));
            assertTrue(e.chars().allMatch(c -> c < 128), e);
        });
    }
    @Test void escapeNoCrashAnyString() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 20), arbitrary().pick(Entities.EscapeMode.values()))
            .checkAssert((s, m) -> Entities.escape(s, new OutputSettings().escapeMode(m)));
    }
    @Test void baseSubsetOfExtended() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 8)).checkAssert(s -> {
            if (Entities.isBaseNamedEntity(s)) assertTrue(Entities.isNamedEntity(s));
        });
        for (String n : NAMES) if (Entities.isBaseNamedEntity(n)) assertTrue(Entities.isNamedEntity(n), n);
    }
    @Test void namesConsistent() {
        qt().forAll(arbitrary().pick(NAMES)).checkAssert(n -> {
            int[] cp = new int[2];
            int k = Entities.codepointsForName(n, cp);
            String v = Entities.getByName(n);
            assertEquals(!v.isEmpty(), k > 0, n);
            assertEquals(v.codePointCount(0, v.length()), k, n);
            if (k > 0) assertEquals(v, new String(cp, 0, k), n);
        });
    }
    @Test void findPrefixProps() {
        qt().forAll(arbitrary().pick(NAMES), strings().basicLatinAlphabet().ofLengthBetween(0, 4)).checkAssert((n, suf) -> {
            String in = n + suf;
            String p = Entities.findPrefix(in);
            assertTrue(in.startsWith(p));
            if (!p.isEmpty()) assertTrue(Entities.isBaseNamedEntity(p));
            for (int i = in.length(); i > p.length(); i--)
                assertFalse(Entities.isBaseNamedEntity(in.substring(0, i)), in);
            if (Entities.isBaseNamedEntity(in)) assertEquals(in, p);
        });
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 6)).checkAssert(in -> {
            String p = Entities.findPrefix(in);
            assertTrue(in.startsWith(p));
            for (int i = in.length(); i > p.length(); i--) assertFalse(Entities.isBaseNamedEntity(in.substring(0, i)), in);
        });
    }
    @Test void unescapeNoCrash() {
        qt().forAll(strings().allPossible().ofLengthBetween(0, 12)).checkAssert(s -> Entities.unescape("&" + s));
    }
    @Test void unescapePlain() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 12)).assuming(s -> !s.contains("&")).checkAssert(s ->
            assertEquals(s, Entities.unescape(s)));
    }
    @Test void unescapeKnown() {
        qt().forAll(arbitrary().pick(NAMES)).checkAssert(n -> {
            if (Entities.isNamedEntity(n) && !n.isEmpty())
                assertEquals(Entities.getByName(n), Entities.unescape("&" + n + ";"), n);
        });
    }
}
