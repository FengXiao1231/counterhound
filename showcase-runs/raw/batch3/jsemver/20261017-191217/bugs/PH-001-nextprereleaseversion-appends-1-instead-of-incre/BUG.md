# nextPreReleaseVersion() appends ".1" instead of incrementing when the last pre-release identifier is "0"

| | |
|---|---|
| Function | `com.github.zafarkhaja.semver.Version.nextPreReleaseVersion` in `src/main/java/com/github/zafarkhaja/semver/Version.java` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.93, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** Version.parse("1.0.0-alpha.0").nextPreReleaseVersion()

**Expected:** 1.0.0-alpha.1

**Actual:** 1.0.0-alpha.0.1

## Reproduce

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

Fails with `AssertionError: expected: <1.0.0-alpha.1> but was: <1.0.0-alpha.0.1>`

Copy it into `src/test/java/` under its package directory (it uses JUnit 5) and run `mvn test -Dtest=ReproZeroIdIncrementTest` or `gradle test --tests '*ReproZeroIdIncrementTest'`.

## Suggested fix

The repro passes with this patch; the project's tests passed (mvn -q -B test). Apply it with `git apply fix.patch`.

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

## Why this is a bug

Javadoc: 'the current pre-release version's last numeric identifier is incremented'. "0" is a valid numeric identifier per SemVer, but private isNumeric() returns false for any id starting with "0", including "0" itself.

Independent review: In Version.java, `isNumeric` returns false for any identifier starting with "0", including "0" itself, which SemVer defines as a valid numeric identifier. `incrementIdentifiers` therefore treats `1.0.0-alpha.0` as having a non-numeric last id and gives `1.0.0-alpha.0.1`, which contradicts the Javadoc ('last numeric identifier is incremented'). The check was clearly meant to exclude only leading-zero forms like "01", which the parser rejects anyway. The same flaw affects `compareIdentifiers`, where "0" is compared as a string. A fix is a one-line change, to `id.equals("0") || !id.startsWith("0")`.

## How it was found

Property: *with no ids, the last numeric identifier of the pre-release is incremented by one*.

QuickTheories shrank the failure to: `Failing test case: {aaa, 0}`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
