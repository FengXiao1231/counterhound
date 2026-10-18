package info.debatty.java.stringsimilarity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    static org.quicktheories.core.Gen<String> g() {
        return strings().basicLatinAlphabet().ofLengthBetween(0, 12);
    }
    static org.quicktheories.core.Gen<String> ab() {
        return strings().betweenCodePoints('a', 'd').ofLengthBetween(0, 12);
    }

    @Test
    void range() {
        qt().withExamples(5000).forAll(ab(), ab()).checkAssert((a, b) -> {
            double s = new JaroWinkler().similarity(a, b);
            assertTrue(s >= 0 && s <= 1, "s=" + s);
        });
    }

    @Test
    void symmetric() {
        qt().withExamples(5000).forAll(ab(), ab()).checkAssert((a, b) -> {
            JaroWinkler j = new JaroWinkler();
            assertEquals(j.similarity(a, b), j.similarity(b, a), 1e-12);
        });
    }

    @Test
    void identity() {
        qt().forAll(g()).checkAssert(a -> assertEquals(1.0, new JaroWinkler().similarity(a, a)));
    }

    @Test
    void distanceComplement() {
        qt().forAll(g(), g()).checkAssert((a, b) -> {
            JaroWinkler j = new JaroWinkler();
            assertEquals(1.0 - j.similarity(a, b), j.distance(a, b), 1e-12);
        });
    }

    @Test
    void jaroLowerBound() {
        qt().withExamples(5000).forAll(ab(), ab()).checkAssert((a, b) -> {
            assertTrue(new JaroWinkler().similarity(a, b) >= new JaroWinkler(-1).similarity(a, b) - 1e-12);
        });
    }

    @Test
    void threshold() {
        qt().forAll(doubles().between(-1, 2)).checkAssert(t -> assertEquals(t, new JaroWinkler(t).getThreshold()));
        assertEquals(0.7, new JaroWinkler().getThreshold());
    }
}
