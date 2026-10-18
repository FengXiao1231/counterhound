You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; counterhound turns your edits into a patch.

## The bug
parseDiff treats an added line whose content starts with '++ ' as a new file header
Function: parseDiff (src/diff.js)
Input: --- a/a.txt
+++ b/a.txt
@@ -4,0 +5 @@
+++ x
@@ -9,0 +11 @@
+y

Expected: Map { 'a.txt' => [[5,5],[11,11]] }
Actual: '+++ x' (an added line with content '++ x') is parsed as a file header: file becomes 'x', a bogus entry 'x' is created and the later hunk is attributed to it, so a.txt loses range [11,11]
Why it is a bug: parseDiff is documented to parse git diff --unified=0 into file -> new-side ranges; with unified=0 added lines are printed as '+' + content, so content '++ x' yields '+++ x' inside a hunk. The parser does not track hunk line counts, so it cannot tell it from a header. Changed functions in the real file can be missed in diff mode.
Reviewer: parseDiff checks `^\+\+\+ ` on every line and never tracks hunk line counts or the preceding `---` line. A real `git diff --unified=0` prints an added line with content `++ x` as `+++ x` inside a hunk. The parser then switches `file` to 'x', creates a bogus entry, and attributes all later hunks to it, so the real file loses ranges. The input is valid git output, and the expected result follows from the function's documented purpose of mapping each file to its new-side ranges. Diff mode could then skip changed functions, and a maintainer would accept a fix that consumes hunk bodies by count or only accepts `+++` right after a `---` line.

A failing test reproduces it: `.counterhound/check/repro_added_line_looks_like_header.test.mjs`. Run it with `./.counterhound/ph-test .counterhound/check/repro_added_line_looks_like_header.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.counterhound/ph-test <test file>`).

counterhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.