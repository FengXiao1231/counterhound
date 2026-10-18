# compareToIgnoreBuildMetadata ranks numeric pre-release identifiers above alphanumeric ones that start with '-'

| | |
|---|---|
| Function | `com.github.zafarkhaja.semver.Version.compareToIgnoreBuildMetadata` in `src/main/java/com/github/zafarkhaja/semver/Version.java` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** 1.0.0-1 vs 1.0.0--a (also 1.0.0-0 vs 1.0.0--x)

**Expected:** 1.0.0-1 < 1.0.0--a

**Actual:** 1.0.0-1 compares greater than 1.0.0--a (ASCII string comparison, '-' < digits)

## Reproduce

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

Fails with `AssertionError: expected: <true> but was: <false>`

Copy it into `src/test/java/` under its package directory (it uses JUnit 5) and run `mvn test -Dtest=ReproNumericVsHyphenIdTest` or `gradle test --tests '*ReproNumericVsHyphenIdTest'`.

## Suggested fix

The repro passes with this patch; the project's tests passed (mvn -q -B test). Apply it with `git apply fix.patch`.

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

## Why this is a bug

Javadoc says the method adheres to the Specification's comparison rules; SemVer 2.0.0 item 11: 'Numeric identifiers always have lower precedence than non-numeric identifiers.' Identifiers may contain '-' ([0-9A-Za-z-]), but compareIdentifiers falls back to String.compareTo when one side is non-numeric.

Independent review: `1.0.0--a` is valid SemVer, since identifiers may contain '-'. SemVer item 11 says numeric identifiers always rank below non-numeric ones. `compareIdentifiers` (Version.java:1331-1337) falls back to `String.compareTo` whenever either side is non-numeric, and '-' (0x2D) sorts before digits, so `1.0.0-1` compares greater than `1.0.0--a`. Digits sort before every other legal identifier character, so only identifiers starting with '-' are affected. A fix is small: if exactly one identifier is numeric, return -1 for the numeric one and 1 for the other. Related: `isNumeric` returns false for "0", so `1.0.0-0` vs `1.0.0--x` is also wrong.

## How it was found

Property: *a numeric pre-release identifier always has lower precedence than an alphanumeric one*.

QuickTheories shrank the failure to: `Failing test case: {0, -x}`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
