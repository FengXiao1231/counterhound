You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; counterhound turns your edits into a patch.

## The bug
compareToIgnoreBuildMetadata ranks numeric pre-release identifiers above alphanumeric ones that start with '-'
Function: com.github.zafarkhaja.semver.Version.compareToIgnoreBuildMetadata (src/main/java/com/github/zafarkhaja/semver/Version.java)
Input: 1.0.0-1 vs 1.0.0--a (also 1.0.0-0 vs 1.0.0--x)
Expected: 1.0.0-1 < 1.0.0--a
Actual: 1.0.0-1 compares greater than 1.0.0--a (ASCII string comparison, '-' < digits)
Why it is a bug: Javadoc says the method adheres to the Specification's comparison rules; SemVer 2.0.0 item 11: 'Numeric identifiers always have lower precedence than non-numeric identifiers.' Identifiers may contain '-' ([0-9A-Za-z-]), but compareIdentifiers falls back to String.compareTo when one side is non-numeric.
Reviewer: `1.0.0--a` is valid SemVer, since identifiers may contain '-'. SemVer item 11 says numeric identifiers always rank below non-numeric ones. `compareIdentifiers` (Version.java:1331-1337) falls back to `String.compareTo` whenever either side is non-numeric, and '-' (0x2D) sorts before digits, so `1.0.0-1` compares greater than `1.0.0--a`. Digits sort before every other legal identifier character, so only identifiers starting with '-' are affected. A fix is small: if exactly one identifier is numeric, return -1 for the numeric one and 1 for the other. Related: `isNumeric` returns false for "0", so `1.0.0-0` vs `1.0.0--x` is also wrong.

A failing test reproduces it: `.counterhound/check/ReproNumericVsHyphenIdTest.java`. Run it with `./.counterhound/ph-test .counterhound/check/ReproNumericVsHyphenIdTest.java` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.counterhound/ph-test <test file>`).

counterhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.