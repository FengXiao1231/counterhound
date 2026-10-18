package org.apache.commons.lang3.time;

import java.text.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static final String[] PATTERNS = {"yyyy-MM-dd HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss.SSSZ", "yyyy-MM-dd HH:mm:ss.SS",
        "EEE, d MMM yyyy HH:mm:ss Z", "yyyy-MM-dd hh:mm a", "yyyy-MM-dd HH:mm:ssXXX", "MMMM d, yyyy", "yyyyMMddHHmmss",
        "yyyy-MM-dd HH:mm Z","yyyy-DDD", "yyyy-MM-dd kk:mm", "yyyy-MM-dd KK:mm a", "EEEE yyyy-MM-dd", "yyyy-MM-dd HH:mm:ssXX", "yyyy-'W'ww-u"};
    static final String[] ZONES = {"UTC", "America/New_York", "Asia/Kolkata", "Europe/Paris", "Australia/Sydney", "GMT+05:30", "Pacific/Auckland"};
    static final Locale[] LOCALES = {Locale.US, Locale.FRANCE, Locale.GERMANY, Locale.JAPAN, Locale.UK, Locale.ITALY, new Locale("es","ES")};

    @Test
    void roundTripParseFormat() {
        qt().forAll(longs().between(0L,4000000000000L), arbitrary().pick(PATTERNS), arbitrary().pick(ZONES), arbitrary().pick(LOCALES))
            .checkAssert((ms, p, z, l) -> {
                FastDateFormat f = FastDateFormat.getInstance(p, TimeZone.getTimeZone(z), l);
                String s = f.format(new Date(ms));
                try {
                    Date d = f.parse(s);
                    assertEquals(s, f.format(d), p + " " + z + " " + l);
                } catch (ParseException e) { fail(p + " " + z + " " + l + " " + s + " " + e); }
            });
    }

    @Test
    void agreesWithSimpleDateFormat() {
        qt().forAll(longs().between(-2000000000000L, 4000000000000L), arbitrary().pick(PATTERNS), arbitrary().pick(ZONES), arbitrary().pick(LOCALES))
            .checkAssert((ms, p, z, l) -> {
                FastDateFormat f = FastDateFormat.getInstance(p, TimeZone.getTimeZone(z), l);
                SimpleDateFormat sdf = new SimpleDateFormat(p, l);
                sdf.setTimeZone(TimeZone.getTimeZone(z));
                assertEquals(sdf.format(new Date(ms)), f.format(new Date(ms)), p + " " + z + " " + l);
                Calendar c = Calendar.getInstance(TimeZone.getTimeZone(z), l);
                c.setTimeInMillis(ms);
                assertEquals(sdf.format(new Date(ms)), f.format(c), p + " " + z + " " + l);
            });
    }

    @Test
    void parseObjectMatchesParse() {
        qt().forAll(longs().between(0, 4000000000000L), arbitrary().pick(PATTERNS), arbitrary().pick(ZONES), arbitrary().pick(LOCALES))
            .checkAssert((ms, p, z, l) -> {
                FastDateFormat f = FastDateFormat.getInstance(p, TimeZone.getTimeZone(z), l);
                String s = f.format(new Date(ms));
                ParsePosition pp = new ParsePosition(0);
                Object o = f.parseObject(s, pp);
                ParsePosition pp2 = new ParsePosition(0);
                Date d = f.parse(s, pp2);
                assertEquals(d, o, p);
                assertEquals(pp2.getIndex(), pp.getIndex());
                assertEquals(-1, pp.getErrorIndex());
                if (o != null) assertEquals(s.length(), pp.getIndex(), p + " " + s);
            });
    }

    @Test
    void styleInstances() {
        qt().forAll(integers().between(0, 15), arbitrary().pick(LOCALES), arbitrary().pick(ZONES), longs().between(0, 4000000000000L))
            .checkAssert((st, l, z, ms) -> {
                int ds = st / 4, ts = st % 4;
                TimeZone tz = TimeZone.getTimeZone(z);
                Date d = new Date(ms);
                DateFormat ref = DateFormat.getDateTimeInstance(ds, ts, l); ref.setTimeZone(tz);
                assertEquals(ref.format(d), FastDateFormat.getDateTimeInstance(ds, ts, tz, l).format(d));
                ref = DateFormat.getDateInstance(ds, l); ref.setTimeZone(tz);
                assertEquals(ref.format(d), FastDateFormat.getDateInstance(ds, tz, l).format(d));
                ref = DateFormat.getTimeInstance(ts, l); ref.setTimeZone(tz);
                assertEquals(ref.format(d), FastDateFormat.getTimeInstance(ts, tz, l).format(d));
            });
    }

    @Test
    void defaultStyleInstances() {
        qt().forAll(arbitrary().pick(0,1,2,3), arbitrary().pick(0,1,2,3), longs().between(0, 4000000000000L))
            .checkAssert((ds, ts, ms) -> {
                Date d = new Date(ms);
                DateFormat ref = DateFormat.getDateTimeInstance(ds, ts, Locale.getDefault());
                assertEquals(ref.format(d), FastDateFormat.getDateTimeInstance(ds, ts).format(d));
                ref = DateFormat.getDateInstance(ds);
                assertEquals(ref.format(d), FastDateFormat.getDateInstance(ds).format(d));
                ref = DateFormat.getTimeInstance(ts);
                assertEquals(ref.format(d), FastDateFormat.getTimeInstance(ts).format(d));
                assertEquals(ref.getTimeZone().getID(), FastDateFormat.getTimeInstance(ts).getTimeZone().getID());
            });
    }

    @Test
    void styleRoundTrip() {
        qt().forAll(arbitrary().pick(0,1,2,3), arbitrary().pick(0,1,2,3), arbitrary().pick(LOCALES), longs().between(0, 4000000000000L))
            .checkAssert((ds, ts, l, ms) -> {
                FastDateFormat f = FastDateFormat.getDateTimeInstance(ds, ts, TimeZone.getTimeZone("UTC"), l);
                Date d = new Date(ms);
                String s = f.format(d);
                try { assertEquals(s, f.format(f.parse(s)), f.getPattern()); }
                catch (ParseException e) { fail(f.getPattern() + " " + l + " " + s + e); }
            });
    }

    @Test
    void parseInvalidThrows() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 10))
            .checkAssert(s -> {
                FastDateFormat f = FastDateFormat.getInstance("yyyy-MM-dd", TimeZone.getTimeZone("UTC"), Locale.US);
                assertThrows(ParseException.class, () -> f.parse(s));
                ParsePosition pp = new ParsePosition(0);
                assertNull(f.parse(s, pp));
                assertNull(f.parseObject(s, pp));
            });
    }
}
