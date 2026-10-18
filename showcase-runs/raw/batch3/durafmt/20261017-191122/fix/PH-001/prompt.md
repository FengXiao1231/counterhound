You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
Format/String negates d.duration in place for negative durations, so repeated calls give wrong output
Function: github.com/hako/durafmt.(*Durafmt).Format (durafmt.go)
Input: d := Parse(-1000 * time.Nanosecond); d.String() twice
Expected: "-1 microsecond" both times; Duration() still -1µs
Actual: first call "-1 microsecond", second call "-"; Duration() returns +1µs after formatting (d.duration = -d.duration is written back to the receiver while d.input still starts with '-')
Why it is a bug: Format is a pure formatting method (String() is also used by fmt via Stringer, and Duration() is a getter); the code negates d.duration in place at durafmt.go:94 whenever input[0]=='-', so each call flips the sign again and formatting has side effects.
Reviewer: durafmt.go:94 does `d.duration = -d.duration` on the receiver whenever input starts with '-', but input is never changed. The first call leaves the stored duration positive, and the second call negates it back to negative, so the unit calculations run on a negative value and the output collapses to "-". Nothing in the docs or tests suggests this is intentional. A pure formatter should be repeatable, and `Duration()` should not change after formatting. The fix is a one-line change to use a local copy of the duration, and a maintainer would take it.

A failing test reproduces it: `.proofhound/check/repro_format_mutates_negative_test.go`. Run it with `./.proofhound/ph-test .proofhound/check/repro_format_mutates_negative_test.go` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.