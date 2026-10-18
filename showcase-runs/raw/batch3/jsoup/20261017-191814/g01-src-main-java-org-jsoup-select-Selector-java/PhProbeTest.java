package org.jsoup.select;
import org.junit.jupiter.api.Test;
import org.jsoup.nodes.*;
import static org.junit.jupiter.api.Assertions.*;

class PhProbeTest {
    void chk(String s) {
        Element d = new Element("div"); d.appendElement("p").attr("id", s);
        String q = "#" + Selector.escapeCssIdentifier(s);
        assertEquals(1, Selector.select(q, d).size(), "id [" + s + "] query [" + q + "]");
    }
    @Test void sp() { chk("a b"); }
    @Test void nl() { chk("a\nb"); }
    @Test void tab() { chk("a\tb"); }
    @Test void dig() { chk("1a"); }
    @Test void punct() { chk("a.b"); }
    @Test void colon() { chk("a:b"); }
    @Test void hy() { chk("-"); }
    @Test void hy1() { chk("-1"); }
    @Test void bs() { chk("a\\b"); }
    @Test void lead() { chk(" a"); }
    @Test void ctl() { chk("a\u0001b"); }
    @Test void del() { chk("a\u007fb"); }
}
