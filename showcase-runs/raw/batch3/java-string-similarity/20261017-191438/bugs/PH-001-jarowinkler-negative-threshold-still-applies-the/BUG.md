# JaroWinkler(negative threshold) still applies the Winkler bonus, contradicting the constructor javadoc

| | |
|---|---|
| Function | `info.debatty.java.stringsimilarity.JaroWinkler.similarity` in `src/main/java/info/debatty/java/stringsimilarity/JaroWinkler.java` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** new JaroWinkler(-1).similarity("ab", "ac")

**Expected:** 2/3 (Jaro, no Winkler bonus)

**Actual:** 0.7 (Winkler bonus applied, since j > threshold is always true)

## Reproduce

```java
package info.debatty.java.stringsimilarity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproNegativeThresholdTest {
    @Test
    void negativeThresholdGivesJaro() {
        // Jaro("ab","ac") = (1/2 + 1/2 + 1) / 3 = 2/3
        assertEquals(2.0 / 3.0, new JaroWinkler(-1).similarity("ab", "ac"), 1e-9);
    }
}
```

Fails with `AssertionError: expected: <0.6666666666666666> but was: <0.7000000178813934>`

Copy it into `src/test/java/` under its package directory (it uses JUnit 5) and run `mvn test -Dtest=ReproNegativeThresholdTest` or `gradle test --tests '*ReproNegativeThresholdTest'`.

## Suggested fix

The repro passes with this patch; the project's tests passed (mvn -q -B test). Apply it with `git apply fix.patch`.

```diff
diff --git a/src/main/java/info/debatty/java/stringsimilarity/JaroWinkler.java b/src/main/java/info/debatty/java/stringsimilarity/JaroWinkler.java
index 267cbb4..cdafb18 100644
--- a/src/main/java/info/debatty/java/stringsimilarity/JaroWinkler.java
+++ b/src/main/java/info/debatty/java/stringsimilarity/JaroWinkler.java
@@ -75,7 +75,7 @@ public class JaroWinkler
         }
 
         int[] mtp = matches(s1, s2);
-        float m = mtp[0];
+        double m = mtp[0];
         if (m == 0) {
             return 0f;
         }
@@ -83,7 +83,7 @@ public class JaroWinkler
                 / THREE;
         double jw = j;
 
-        if (j > getThreshold()) {
+        if (getThreshold() >= 0 && j > getThreshold()) {
             jw = j + Math.min(JW_COEF, 1.0 / mtp[THREE]) * mtp[2] * (1 - j);
         }
         return jw;
```

## Why this is a bug

Constructor javadoc: 'Set threshold to a negative value to get the Jaro distance.' The code adds the bonus when j > threshold, so a negative threshold always adds it; Jaro needs threshold >= 1.

Independent review: The constructor javadoc says 'Set threshold to a negative value to get the Jaro distance.' But `similarity` adds the bonus whenever `j > threshold`, and j is never negative, so a negative threshold applies the bonus on every non-zero match. For ("ab","ac") the plain Jaro value is 2/3 and the code returns about 0.7. The repro uses the API correctly, and the 1e-9 tolerance is not the issue: the result differs by 0.033, with only a small float-precision error on top. A maintainer would fix either the code (a negative threshold disables the bonus) or the javadoc.

## How it was found

Property: *with a negative threshold, similarity equals the plain Jaro similarity (no Winkler bonus)*.

QuickTheories shrank the failure to: `Failing test case: {a, aaaaaaaaaa}`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
