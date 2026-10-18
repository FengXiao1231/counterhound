You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
format_timespan(0, detailed=True) returns an empty string instead of '0 seconds'
Function: humanfriendly.format_timespan (humanfriendly/__init__.py)
Input: format_timespan(0, detailed=True)
Expected: '0 seconds' (as format_timespan(0) gives)
Actual: '' (empty string), because all unit counts are zero and concatenate([]) is ''
Why it is a bug: Docstring: format_timespan(0) -> '0 seconds'; returns 'The formatted timespan as a string'. detailed only changes how milliseconds are represented, so zero should still render as a quantity.
Reviewer: The input is valid, because coerce_seconds accepts 0 and the docstring says format_timespan(0) gives '0 seconds'. With detailed=True the slow path skips every zero-count unit, so `result` is empty and `concatenate([])` returns ''. The docstring says `detailed` only changes how milliseconds are shown, and no test or doc says an empty result is intended. The tests cover only non-zero values with detailed=True, so the empty string looks like an unhandled edge case, not a deliberate choice. A small fix is easy: return pluralize(0, 'second') when `result` is empty. Severity is low because it is a rare edge case.

A failing test reproduces it: `.proofhound/check/test_repro_timespan_zero_detailed.py`. Run it with `./.proofhound/ph-test .proofhound/check/test_repro_timespan_zero_detailed.py` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.