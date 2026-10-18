package org.jsoup.select;
import org.junit.jupiter.api.Test;
import org.jsoup.nodes.*;
import static org.junit.jupiter.api.Assertions.*;

class ReproTrailingSpaceTest {
    @Test void escapedTrailingSpaceSurvivesSelect() {
        Element d = new Element("div");
        d.appendElement("p").attr("id", "a ");
        String q = "#" + Selector.escapeCssIdentifier("a ");
        assertEquals("#a\\ ", q);
        assertEquals(1, Selector.select(q, d).size());
    }
}
