# Selector parsing drops an escaped trailing space because the query is trimmed first

| | |
|---|---|
| Function | `org.jsoup.select.Selector.select` in `src/main/java/org/jsoup/select/Selector.java` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** element with id "a "; query "#a\ " (from escapeCssIdentifier("a "))

**Expected:** 1 element matched (an escaped space '\ ' is part of the identifier per CSS syntax)

**Actual:** 0 elements: the trailing escaped space is stripped when the query is trimmed, so the id parsed is 'a' followed by a dangling escape

## Reproduce

```java
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
```

Fails with `AssertionError: expected: <1> but was: <0>`

Copy it into `src/test/java/` under its package directory (it uses JUnit 5) and run `mvn test -Dtest=ReproTrailingSpaceTest` or `gradle test --tests '*ReproTrailingSpaceTest'`.

## Suggested fix

The repro passes with this patch; the project's tests passed (mvn -q -B test). Apply it with `git apply fix.patch`.

```diff
diff --git a/src/main/java/org/jsoup/select/QueryParser.java b/src/main/java/org/jsoup/select/QueryParser.java
index b791474..0c08e6c 100644
--- a/src/main/java/org/jsoup/select/QueryParser.java
+++ b/src/main/java/org/jsoup/select/QueryParser.java
@@ -22,6 +22,7 @@ import java.util.regex.Matcher;
 import java.util.regex.Pattern;
 
 import static org.jsoup.internal.Normalizer.asciiLowerCase;
+import static org.jsoup.internal.StringUtil.isWhitespace;
 import static org.jsoup.internal.StringUtil.trimAsciiWhitespace;
 import static org.jsoup.select.StructuralEvaluator.ImmediateParentRun;
 
@@ -43,11 +44,24 @@ public class QueryParser implements AutoCloseable {
      */
     private QueryParser(String query) {
         Validate.notEmpty(query);
-        query = trimAsciiWhitespace(query);
+        query = trimQuery(query);
         this.query = query;
         this.tq = new TokenQueue(query);
     }
 
+    // Trims ASCII whitespace, but keeps trailing whitespace that is escaped by a backslash (part of an identifier).
+    private static String trimQuery(String query) {
+        int start = 0, end = query.length();
+        while (start < end && isWhitespace(query.charAt(start))) start++;
+        while (end > start && isWhitespace(query.charAt(end - 1))) {
+            int slashes = 0;
+            for (int i = end - 2; i >= start && query.charAt(i) == '\\'; i--) slashes++;
+            if (slashes % 2 == 1) break; // escaped whitespace
+            end--;
+        }
+        return query.substring(start, end);
+    }
+
     /**
      Parse a CSS query into an Evaluator. If you are evaluating the same query repeatedly, it may be more efficient to
      parse it once and reuse the Evaluator.
```

## Why this is a bug

escapeCssIdentifier is documented to escape characters 'that would otherwise not be valid in a selector' (CSSOM serialize-an-identifier), so its output should be usable in a selector; it emits '\ ' for space, which select() then mishandles at the end of the query

Independent review: `QueryParser` calls `trimAsciiWhitespace(query)` before tokenizing, so the `\ ` that `Selector.escapeCssIdentifier("a ")` emits loses its space and leaves a dangling backslash. The public `escapeCssIdentifier` is documented to produce text valid in a selector, and CSS treats an escaped trailing space as part of the identifier. A maintainer would likely accept a small fix: only trim a trailing whitespace character when it is not preceded by an unescaped backslash. The case is narrow, since it needs an identifier that ends in whitespace.

## How it was found

Property: *a selector built as '#' + escapeCssIdentifier(id) matches the element with that id*.

QuickTheories shrank the failure to: `Failing test case: `

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
