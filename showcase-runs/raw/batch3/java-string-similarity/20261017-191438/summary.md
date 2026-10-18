<!-- counterhound-report -->
### counterhound found 1 provable bug (1 with a verified fix)

Checked 5 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> JaroWinkler(negative threshold) still applies the Winkler bonus, contradicting the constructor javadoc <sub>(wrong result, src/main/java/info/debatty/java/stringsimilarity/JaroWinkler.java)</sub></summary>

| | |
|---|---|
| Function | `info.debatty.java.stringsimilarity.JaroWinkler.similarity` |
| Input | new JaroWinkler(-1).similarity("ab", "ac") |
| Expected | 2/3 (Jaro, no Winkler bonus) |
| Actual | 0.7 (Winkler bonus applied, since j > threshold is always true) |
| Review | low severity, confidence 0.85 |

The constructor javadoc says 'Set threshold to a negative value to get the Jaro distance.' But `similarity` adds the bonus whenever `j > threshold`, and j is never negative, so a negative threshold applies the bonus on every non-zero match. For ("ab","ac") the plain Jaro value is 2/3 and the code returns about 0.7. The repro uses the API correctly, and the 1e-9 tolerance is not the issue: the result differs by 0.033, with only a small float-precision error on top. A maintainer would fix either the code (a negative threshold disables the bonus) or the javadoc.

Failing test (`ReproNegativeThresholdTest.java`, failed 3/3 runs):

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

Suggested fix (the repro passes with it; project tests passed (mvn -q -B test)):

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
</details>

<sub>2m15s · $0.38 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
