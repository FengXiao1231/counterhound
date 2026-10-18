package org.apache.commons.text;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static org.quicktheories.core.Gen<String> g() {
        return strings().basicLatinAlphabet().ofLengthBetween(0, 12)
            .zip(strings().allPossible().ofLengthBetween(0, 6),
                 integers().between(0, 10), (a, b, i) -> a + "\"\\/',\r\n\t $&".charAt(i) + b + a);
    }
    static org.quicktheories.core.Gen<String> valid() {
        return g().map(s -> {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < s.length(); ) { int cp = s.codePointAt(i); i += Character.charCount(cp);
                if (cp < 0xD800 || cp > 0xDFFF) sb.appendCodePoint(cp); }
            return sb.toString(); });
    }
    @Test void javaRT() { qt().forAll(valid()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeJava(StringEscapeUtils.escapeJava(s)))); }
    @Test void ecmaRT() { qt().forAll(valid()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeEcmaScript(StringEscapeUtils.escapeEcmaScript(s)))); }
    @Test void jsonRT() { qt().forAll(valid()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeJson(StringEscapeUtils.escapeJson(s)))); }
    @Test void htmlRT() { qt().forAll(valid()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeHtml4(StringEscapeUtils.escapeHtml4(s)))); }
    @Test void csvRT() { qt().forAll(valid()).checkAssert(s -> assertEquals(s, StringEscapeUtils.unescapeCsv(StringEscapeUtils.escapeCsv(s)))); }
    @Test void xsiRT() { qt().forAll(valid()).checkAssert(s -> { String t = s.replace("\r\n","").replace("\n",""); assertEquals(t, StringEscapeUtils.unescapeXSI(StringEscapeUtils.escapeXSI(s))); }); }
    @Test void asciiOut() { qt().forAll(valid()).checkAssert(s -> {
        for (String e : new String[]{StringEscapeUtils.escapeJava(s), StringEscapeUtils.escapeEcmaScript(s), StringEscapeUtils.escapeJson(s)})
            for (char c : e.toCharArray()) assertTrue(c >= 32 && c < 127, e); }); }
}
