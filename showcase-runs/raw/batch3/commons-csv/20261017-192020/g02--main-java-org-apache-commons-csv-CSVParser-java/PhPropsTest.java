package org.apache.commons.csv;

import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

import java.io.File;
import java.io.StringReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;

import org.junit.jupiter.api.Test;
import org.quicktheories.core.Gen;

class PhPropsTest {

    static final Gen<String> FIELD = strings().allPossible().ofLengthBetween(0, 6)
            .map(s -> s.replaceAll("[\\uD800-\\uDFFF]", "x"));
    static final Gen<List<String>> RECORD = lists().of(FIELD).ofSizeBetween(1, 4);
    static final Gen<List<List<String>>> RECORDS = lists().of(RECORD).ofSizeBetween(0, 5);

    static String print(final CSVFormat f, final List<List<String>> recs) {
        final StringWriter w = new StringWriter();
        try (CSVPrinter p = new CSVPrinter(w, f)) {
            for (final List<String> r : recs) {
                p.printRecord(r);
            }
        } catch (final java.io.IOException e) {
            throw new RuntimeException(e);
        }
        return w.toString();
    }

    static List<List<String>> toLists(final List<CSVRecord> rs) {
        final List<List<String>> out = new ArrayList<>();
        for (final CSVRecord r : rs) {
            out.add(r.toList());
        }
        return out;
    }

    @Test
    void fileRoundTrip() {
        qt().forAll(RECORDS).checkAssert(recs -> {
            try {
                final File f = File.createTempFile("phtest", ".csv");
                f.deleteOnExit();
                Files.write(f.toPath(), print(CSVFormat.DEFAULT, recs).getBytes(StandardCharsets.UTF_8));
                try (CSVParser p = CSVParser.parse(f, StandardCharsets.UTF_8, CSVFormat.DEFAULT)) {
                    assertEquals(recs, toLists(p.getRecords()));
                }
                f.delete();
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            } catch (final Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void stringRoundTripVariousFormats() {
        qt().forAll(RECORDS, arbitrary().pick(CSVFormat.DEFAULT, CSVFormat.EXCEL, CSVFormat.TDF, CSVFormat.RFC4180,
                CSVFormat.DEFAULT.builder().setQuoteMode(QuoteMode.ALL).get(),
                CSVFormat.DEFAULT.builder().setTrailingDelimiter(true).get(),
                CSVFormat.DEFAULT.builder().setNullString("NULL").get())).checkAssert((recs, fmt) -> {
            try {
                final String s = print(fmt, recs);
                try (CSVParser p = CSVParser.parse(s, fmt)) {
                    assertEquals(recs, toLists(p.getRecords()), "text=" + s + " fmt=" + fmt);
                }
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            } catch (final RuntimeException e) {
                throw e;
            } catch (final Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void iteratorMatchesGetRecordsAndHasNextIdempotent() {
        qt().forAll(RECORDS).checkAssert(recs -> {
            try {
                final String s = print(CSVFormat.DEFAULT, recs);
                final List<List<String>> viaIter = new ArrayList<>();
                try (CSVParser p = CSVParser.parse(s, CSVFormat.DEFAULT)) {
                    final Iterator<CSVRecord> it = p.iterator();
                    while (it.hasNext()) {
                        assertTrue(it.hasNext());
                        viaIter.add(it.next().toList());
                    }
                    assertThrows(NoSuchElementException.class, it::next);
                    assertFalse(it.hasNext());
                }
                assertEquals(recs, viaIter);
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            } catch (final Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void maxRows() {
        qt().forAll(RECORDS, integers().between(1, 6)).checkAssert((recs, n) -> {
            try {
                final CSVFormat fmt = CSVFormat.DEFAULT.builder().setMaxRows(n).get();
                final String s = print(CSVFormat.DEFAULT, recs);
                final int exp = Math.min(n, recs.size());
                try (CSVParser p = CSVParser.parse(s, fmt)) {
                    assertEquals(recs.subList(0, exp), toLists(p.getRecords()));
                }
                try (CSVParser p = CSVParser.parse(s, fmt)) {
                    assertEquals(exp, p.stream().count());
                }
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            } catch (final Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void headerAndRecordNumbers() {
        qt().forAll(RECORDS).checkAssert(recs -> {
            try {
                final String s = print(CSVFormat.DEFAULT, recs);
                try (CSVParser p = CSVParser.parse(s, CSVFormat.DEFAULT)) {
                    long i = 1;
                    for (final CSVRecord r : p) {
                        assertEquals(i++, r.getRecordNumber());
                    }
                }
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void commentsHeaderTrailer() {
        final Gen<String> word = strings().basicLatinAlphabet().ofLengthBetween(1, 5).map(s -> s.replaceAll("[^a-zA-Z]", "a"));
        qt().forAll(word, word, word, word).checkAssert((hc, a, b, tc) -> {
            try {
                final CSVFormat fmt = CSVFormat.DEFAULT.builder().setCommentMarker('#').setHeader().get();
                final String s = "#" + hc + "\nh1,h2\n" + a + "," + b + "\n#" + tc + "\n";
                try (CSVParser p = CSVParser.parse(s, fmt)) {
                    assertTrue(p.hasHeaderComment());
                    assertEquals(hc, p.getHeaderComment());
                    assertFalse(p.hasTrailerComment());
                    final List<CSVRecord> rs = p.getRecords();
                    assertEquals(1, rs.size());
                    assertTrue(p.hasTrailerComment());
                    assertEquals(tc, p.getTrailerComment());
                }
                final CSVFormat fmt2 = CSVFormat.DEFAULT.builder().setCommentMarker('#').get();
                try (CSVParser p = CSVParser.parse(s, fmt2)) {
                    assertFalse(p.hasHeaderComment());
                    final List<CSVRecord> rs = p.getRecords();
                    assertEquals(2, rs.size());
                    assertEquals(hc, rs.get(0).getComment());
                    assertTrue(p.hasTrailerComment());
                }
                // no trailing comment
                final String s2 = "h1,h2\n" + a + "," + b + "\n";
                try (CSVParser p = CSVParser.parse(s2, fmt)) {
                    p.getRecords();
                    assertFalse(p.hasHeaderComment());
                    assertFalse(p.hasTrailerComment());
                }
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void explicitHeaderCommentGoesToFirstRecord() {
        final Gen<String> word = strings().basicLatinAlphabet().ofLengthBetween(1, 5).map(s -> s.replaceAll("[^a-zA-Z]", "a"));
        qt().forAll(word, word).checkAssert((hc, a) -> {
            try {
                final CSVFormat fmt = CSVFormat.DEFAULT.builder().setCommentMarker('#').setHeader("x", "y").get();
                final String s = "#" + hc + "\n" + a + ",b\n";
                try (CSVParser p = CSVParser.parse(s, fmt)) {
                    assertFalse(p.hasHeaderComment());
                    final List<CSVRecord> rs = p.getRecords();
                    assertEquals(hc, rs.get(0).getComment());
                    assertEquals(a, rs.get(0).get("x"));
                }
                final CSVFormat fmt2 = fmt.builder().setSkipHeaderRecord(true).get();
                final String s2 = "#" + hc + "\nx,y\n" + a + ",b\n";
                try (CSVParser p = CSVParser.parse(s2, fmt2)) {
                    assertTrue(p.hasHeaderComment());
                    assertEquals(hc, p.getHeaderComment());
                    assertEquals(1, p.getRecords().size());
                }
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void closedParserYieldsNothing() {
        qt().forAll(RECORDS).checkAssert(recs -> {
            try {
                final String s = print(CSVFormat.DEFAULT, recs);
                final CSVParser p = CSVParser.parse(new StringReader(s), CSVFormat.DEFAULT);
                p.close();
                assertFalse(p.iterator().hasNext());
                assertEquals(0, p.stream().count());
                assertThrows(NoSuchElementException.class, () -> p.iterator().next());
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            }
        });
    }

    @Test
    void nullStringRoundTripWithEscape() {
        final Gen<String> fld = strings().basicLatinAlphabet().ofLengthBetween(0, 4);
        qt().forAll(lists().of(arbitrary().pick("N", "\\N", "a", "", null, "\\")).ofSizeBetween(1, 4))
                .checkAssert(rec -> {
                    try {
                        final CSVFormat fmt = CSVFormat.DEFAULT.builder().setNullString("\\N").setEscape('\\').get();
                        final StringWriter w = new StringWriter();
                        try (CSVPrinter pr = new CSVPrinter(w, fmt)) {
                            pr.printRecord(rec);
                        }
                        try (CSVParser p = CSVParser.parse(w.toString(), fmt)) {
                            assertEquals(rec, p.getRecords().get(0).toList(), "text=" + w);
                        }
                    } catch (final java.io.IOException e) {
                        throw new RuntimeException(e);
                    }
                });
    }

    @Test
    void trailingDelimiterQuotedEmpty() {
        qt().forAll(lists().of(arbitrary().pick("", "a")).ofSizeBetween(1, 4)).checkAssert(rec -> {
            try {
                final CSVFormat fmt = CSVFormat.DEFAULT.builder().setTrailingDelimiter(true).get();
                final String s = print(fmt, java.util.Collections.singletonList(rec));
                try (CSVParser p = CSVParser.parse(s, fmt)) {
                    assertEquals(rec, p.getRecords().get(0).toList(), "text=" + s);
                }
            } catch (final java.io.IOException e) {
                throw new RuntimeException(e);
            } catch (final Exception e) {
                throw new RuntimeException(e);
            }
        });
    }
}
