package org.apache.commons.csv;

import java.io.StringReader;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static final String ALPHA = "ab ,\"\n\r\t;'\\é";
    static org.quicktheories.core.Gen<String> str() {
        return lists().of(integers().between(0, ALPHA.length() - 1)).ofSizeBetween(0, 6)
            .map(l -> { StringBuilder sb = new StringBuilder(); for (int i : l) sb.append(ALPHA.charAt(i)); return sb.toString(); });
    }
    static org.quicktheories.core.Gen<List<String>> rec() {
        return lists().of(str()).ofSizeBetween(1, 5);
    }

    static List<String> roundTrip(CSVFormat f, List<String> vals) throws Exception {
        String s = f.format(vals.toArray());
        try (CSVParser p = f.parse(new StringReader(s))) {
            List<CSVRecord> rs = p.getRecords();
            assertEquals(1, rs.size(), "records for [" + s + "]");
            return rs.get(0).toList();
        }
    }

    @Test void roundTripDefault() {
        qt().forAll(rec()).checkAssert(v -> {
            try { assertEquals(v, roundTrip(CSVFormat.DEFAULT, v)); } catch (Exception e) { throw new RuntimeException(e); }
        });
    }
    @Test void roundTripEscape() {
        CSVFormat f = CSVFormat.newFormat(',').withEscape('\\');
        qt().forAll(rec()).assuming(v -> !(v.size() == 1 && v.get(0).isEmpty())).checkAssert(v -> {
            try { assertEquals(v, roundTrip(f, v)); } catch (Exception e) { throw new RuntimeException(e); }
        });
    }
    @Test void roundTripEscapeQuoted() {
        CSVFormat f = CSVFormat.DEFAULT.withEscape('\\');
        qt().forAll(rec()).checkAssert(v -> {
            try { assertEquals(v, roundTrip(f, v)); } catch (Exception e) { throw new RuntimeException(e); }
        });
    }
    @Test void roundTripSemicolonRS() {
        CSVFormat f = CSVFormat.newFormat(';').withQuote('"').withRecordSeparator('\n');
        qt().forAll(rec()).checkAssert(v -> {
            try { assertEquals(v, roundTrip(f, v)); } catch (Exception e) { throw new RuntimeException(e); }
        });
    }
    @Test void systemSeparator() {
        CSVFormat f = CSVFormat.DEFAULT.withSystemRecordSeparator();
        assertEquals(System.lineSeparator(), f.getRecordSeparator());
        assertEquals("a,b", f.format("a", "b"));
    }
    @Test void newFormatDelim() {
        qt().forAll(integers().between(33, 126)).assuming(c -> c != '"' && c != '\\').checkAssert(c -> {
            CSVFormat f = CSVFormat.newFormat((char) (int) c);
            assertEquals((char) (int) c, f.getDelimiterString().charAt(0));
            assertEquals("a" + (char) (int) c + "b", f.format("a", "b"));
        });
    }
}
