<!-- counterhound-report -->
### counterhound found 2 provable bugs (2 with a verified fix)

Checked 12 functions in 2 modules with property-based tests. 2 reported → 2 reproduced → 2 unique → 2 confirmed by an independent review.

<details><summary><b>PH-001</b> nextPreReleaseVersion() appends ".1" instead of incrementing when the last pre-release identifier is "0" <sub>(wrong result, src/main/java/com/github/zafarkhaja/semver/Version.java)</sub></summary>

| | |
|---|---|
| Function | `com.github.zafarkhaja.semver.Version.nextPreReleaseVersion` |
| Input | Version.parse("1.0.0-alpha.0").nextPreReleaseVersion() |
| Expected | 1.0.0-alpha.1 |
| Actual | 1.0.0-alpha.0.1 |
| Review | low severity, confidence 0.93 |

In Version.java, `isNumeric` returns false for any identifier starting with "0", including "0" itself, which SemVer defines as a valid numeric identifier. `incrementIdentifiers` therefore treats `1.0.0-alpha.0` as having a non-numeric last id and gives `1.0.0-alpha.0.1`, which contradicts the Javadoc ('last numeric identifier is incremented'). The check was clearly meant to exclude only leading-zero forms like "01", which the parser rejects anyway. The same flaw affects `compareIdentifiers`, where "0" is compared as a string. A fix is a one-line change, to `id.equals("0") \|\| !id.startsWith("

Failing test (`ReproZeroIdIncrementTest.java`, failed 3/3 runs):

```java
package com.github.zafarkhaja.semver;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproZeroIdIncrementTest {
    @Test
    void incrementsNumericZeroIdentifier() {
        assertEquals("1.0.0-alpha.1", Version.parse("1.0.0-alpha.0").nextPreReleaseVersion().toString());
    }
}
```

Suggested fix (the repro passes with it; project tests passed (mvn -q -B test)):

```diff
diff --git a/src/main/java/com/github/zafarkhaja/semver/Version.java b/src/main/java/com/github/zafarkhaja/semver/Version.java
index 0da587c..59301e9 100644
--- a/src/main/java/com/github/zafarkhaja/semver/Version.java
+++ b/src/main/java/com/github/zafarkhaja/semver/Version.java
@@ -1338,7 +1338,7 @@ public class Version implements Comparable<Version>, Serializable {
 
     private static boolean isNumeric(String id) {
         // filters out <digits>
-        if (id.startsWith("0")) {
+        if (id.startsWith("0") && !id.equals("0")) {
             return false;
         }
         return id.chars().allMatch(Character::isDigit);
```
</details>

<details><summary><b>PH-002</b> compareToIgnoreBuildMetadata ranks numeric pre-release identifiers above alphanumeric ones that start with '-' <sub>(wrong result, src/main/java/com/github/zafarkhaja/semver/Version.java)</sub></summary>

| | |
|---|---|
| Function | `com.github.zafarkhaja.semver.Version.compareToIgnoreBuildMetadata` |
| Input | 1.0.0-1 vs 1.0.0--a (also 1.0.0-0 vs 1.0.0--x) |
| Expected | 1.0.0-1 < 1.0.0--a |
| Actual | 1.0.0-1 compares greater than 1.0.0--a (ASCII string comparison, '-' < digits) |
| Review | low severity, confidence 0.93 |

`1.0.0--a` is valid SemVer, since identifiers may contain '-'. SemVer item 11 says numeric identifiers always rank below non-numeric ones. `compareIdentifiers` (Version.java:1331-1337) falls back to `String.compareTo` whenever either side is non-numeric, and '-' (0x2D) sorts before digits, so `1.0.0-1` compares greater than `1.0.0--a`. Digits sort before every other legal identifier character, so only identifiers starting with '-' are affected. A fix is small: if exactly one identifier is numeric, return -1 for the numeric one and 1 for the other. Related: `isNumeric` returns false for "0", so

Failing test (`ReproNumericVsHyphenIdTest.java`, failed 3/3 runs):

```java
package com.github.zafarkhaja.semver;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReproNumericVsHyphenIdTest {
    @Test
    void numericIdentifierHasLowerPrecedenceThanAlphanumeric() {
        Version num = Version.parse("1.0.0-1");
        Version alpha = Version.parse("1.0.0--a");
        assertTrue(num.compareToIgnoreBuildMetadata(alpha) < 0);
        assertTrue(alpha.compareToIgnoreBuildMetadata(num) > 0);
    }
}
```

Suggested fix (the repro passes with it; project tests passed (mvn -q -B test)):

```diff
diff --git a/src/main/java/com/github/zafarkhaja/semver/Version.java b/src/main/java/com/github/zafarkhaja/semver/Version.java
index 0da587c..e9d3e5c 100644
--- a/src/main/java/com/github/zafarkhaja/semver/Version.java
+++ b/src/main/java/com/github/zafarkhaja/semver/Version.java
@@ -1329,8 +1329,15 @@ public class Version implements Comparable<Version>, Serializable {
     }
 
     private static int compareIdentifiers(String thisId, String otherId) {
-        if (isNumeric(thisId) && isNumeric(otherId)) {
+        boolean thisNumeric = thisId.equals("0") || isNumeric(thisId);
+        boolean otherNumeric = otherId.equals("0") || isNumeric(otherId);
+        if (thisNumeric && otherNumeric) {
             return Long.valueOf(thisId).compareTo(Long.valueOf(otherId));
+        } else if (thisNumeric) {
+            // numeric identifiers always have lower precedence (SemVer p.11)
+            return -1;
+        } else if (otherNumeric) {
+            return 1;
         } else {
             return thisId.compareTo(otherId);
         }
```
</details>

<sub>2m29s · $0.56 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
