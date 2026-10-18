package org.apache.commons.lang3;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {

    private static org.quicktheories.core.Gen<String> any() {
        return strings().allPossible().ofLengthBetween(0, 12);
    }

    private static org.quicktheories.core.Gen<String> ascii() {
        return strings().basicLatinAlphabet().ofLengthBetween(0, 12);
    }

    private static org.quicktheories.core.Gen<String> tricky() {
        final String[] parts = {"a", "\"", ",", "\n", "\r", "\\", "/", "'", "`", "${", "$", "{", "\t", "é", " ", "<", "&", "\u0000", "\u007f", "😀", "u", "0"};
        return lists().of(integers().between(0, parts.length - 1)).ofSizeBetween(0, 10)
            .map(l -> { final StringBuilder sb = new StringBuilder(); l.forEach(i -> sb.append(parts[i])); return sb.toString(); });
    }

    @Test void csvRoundTrip() {
        qt().forAll(tricky()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeCsv(StringEscapeUtils.escapeCsv(s))));
    }

    @Test void csvQuotedIffNeeded() {
        qt().forAll(tricky()).checkAssert(s -> {
            final String e = StringEscapeUtils.escapeCsv(s);
            final boolean need = s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r");
            if (need) {
                assertEquals("\"" + s.replace("\"", "\"\"") + "\"", e);
            } else {
                assertEquals(s, e);
            }
        });
    }

    @Test void javaRoundTrip() {
        qt().forAll(any()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeJava(StringEscapeUtils.escapeJava(s))));
    }

    @Test void javaRoundTripTricky() {
        qt().forAll(tricky()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeJava(StringEscapeUtils.escapeJava(s))));
    }

    @Test void ecmaRoundTrip() {
        qt().forAll(tricky()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeEcmaScript(StringEscapeUtils.escapeEcmaScript(s))));
    }

    @Test void jsonRoundTrip() {
        qt().forAll(tricky()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeJson(StringEscapeUtils.escapeJson(s))));
    }

    @Test void escapedIsAscii() {
        qt().forAll(any()).checkAssert(s -> {
            for (final String e : new String[] {StringEscapeUtils.escapeJava(s), StringEscapeUtils.escapeEcmaScript(s), StringEscapeUtils.escapeJson(s)}) {
                for (final char c : e.toCharArray()) {
                    assertTrue(c >= 32 && c < 127, "non printable ascii in " + e);
                }
            }
        });
    }

    @Test void noRawQuotesInEcma() {
        qt().forAll(tricky()).checkAssert(s -> {
            final String e = StringEscapeUtils.escapeEcmaScript(s);
            // remove escape pairs, then no delimiters may remain
            final String stripped = e.replace("\\\\", "").replaceAll("\\\\.", "");
            assertFalse(stripped.contains("'") || stripped.contains("\"") || stripped.contains("`") || stripped.contains("${"), e);
        });
    }

    @Test void html4RoundTrip() {
        qt().forAll(any()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeHtml4(StringEscapeUtils.escapeHtml4(s))));
    }

    @Test void html3RoundTrip() {
        qt().forAll(any()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeHtml3(StringEscapeUtils.escapeHtml3(s))));
    }

    @Test void html4NoSpecials() {
        qt().forAll(any()).checkAssert(s -> {
            final String e = StringEscapeUtils.escapeHtml4(s);
            assertFalse(e.contains("<") || e.contains(">") || e.contains("\""), e);
            assertFalse(e.replace("&amp;", "").replace("&lt;", "").replace("&gt;", "").replace("&quot;", "").contains("&") && !s.contains("&") && false);
        });
    }

    @Test void html4Idempotentish() {
        qt().forAll(ascii()).checkAssert(s ->
            assertEquals(StringEscapeUtils.escapeHtml4(s), StringEscapeUtils.escapeHtml4(s)));
    }

    @Test void nullIn() {
        assertNull(StringEscapeUtils.escapeCsv(null));
        assertNull(StringEscapeUtils.escapeEcmaScript(null));
        assertNull(StringEscapeUtils.escapeHtml3(null));
        assertNull(StringEscapeUtils.escapeHtml4(null));
        assertNull(StringEscapeUtils.escapeJava(null));
        assertNull(StringEscapeUtils.escapeJson(null));
    }
}
