You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
Capitalisation splits surrogate pairs, so words starting with astral cased letters are not capitalised
Function: pascalSnakeCase (via capitalCaseTransformFactory; also pascalCase/camelCase) (packages/change-case/src/index.ts)
Input: pascalSnakeCase('\u{10428}a', {locale:false})
Expected: '\u{10400}a' (first letter uppercased)
Actual: '\u{10428}a' (unchanged)
Why it is a bug: split() uses \p{L} with the u flag, so astral letters count as word letters, but capitalCaseTransformFactory does upper(word[0]) / word.slice(1), which cuts a surrogate pair in half; toUpperCase of a lone high surrogate is a no-op. Doc: 'Convert a string to pascal snake case (Foo_Bar)'.
Reviewer: The splitter uses \p{L} with the u flag, so an astral letter such as U+10428 is a valid word character. capitalCaseTransformFactory and pascalCaseTransformFactory then take word[0] and word.slice(1), which cut the surrogate pair in half. toUpperCase on a lone surrogate does nothing, so the first letter stays lowercase and the documented 'Foo_Bar' capitalisation is not applied. The input is valid and the repro is correct. A fix is small (use the first code point, e.g. String.fromCodePoint(word.codePointAt(0)) or Array.from), though the affected scripts (Deseret, Osage, Adlam and similar) are rare.

A failing test reproduces it: `.proofhound/check/repro_astral_capitalize.test.mjs`. Run it with `./.proofhound/ph-test .proofhound/check/repro_astral_capitalize.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.