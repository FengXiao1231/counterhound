package org.jsoup.select;
import org.junit.jupiter.api.Test;
import org.jsoup.nodes.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.quicktheories.QuickTheory.qt;
import static org.quicktheories.generators.SourceDSL.*;

class PhPropsTest {
    @Test void roundTripAll() {
        qt().forAll(strings().allPossible().ofLengthBetween(1, 8))
            .assuming(s -> s.indexOf(0) < 0)
            .checkAssert(s -> assertEquals(s, Selector.unescapeCssIdentifier(Selector.escapeCssIdentifier(s))));
    }
    @Test void roundTripAscii() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(1, 8))
            .checkAssert(s -> assertEquals(s, Selector.unescapeCssIdentifier(Selector.escapeCssIdentifier(s))));
    }
    @Test void selectById() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(1, 6))
            .assuming(s -> s.indexOf(0) < 0)
            .checkAssert(s -> {
                Element d = new Element("div"); d.appendElement("p").attr("id", s);
                assertEquals(1, Selector.select("#" + Selector.escapeCssIdentifier(s), d).size(), "id=[" + s + "] q=" + Selector.escapeCssIdentifier(s));
            });
    }
    @Test void selectByClass() {
        qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(1, 6))
            .assuming(s -> s.chars().noneMatch(Character::isWhitespace))
            .checkAssert(s -> {
                Element d = new Element("div"); d.appendElement("p").addClass(s);
                assertEquals(1, Selector.select("." + Selector.escapeCssIdentifier(s), d).size());
            });
    }
}
