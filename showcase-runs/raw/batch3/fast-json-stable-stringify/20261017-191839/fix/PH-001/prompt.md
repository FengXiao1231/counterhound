You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; counterhound turns your edits into a patch.

## The bug
Cycles consisting only of arrays are not detected and cause a RangeError (stack overflow)
Function: index (module.exports) (index.js)
Input: const a = []; a.push(a); index(a) and index(a, {cycles:true})
Expected: index(a) throws TypeError; index(a, {cycles:true}) returns '["__cycle__"]'
Actual: RangeError: Maximum call stack size exceeded in both cases
Why it is a bug: README documents the cycles option (cycle detection returns '__cycle__', otherwise TypeError as in JSON.stringify). Code only records objects in `seen` after the Array.isArray branch returns, so arrays are never tracked.
Reviewer: index.js returns from the Array.isArray branch (lines 29-36) before `seen` is checked or updated (lines 40-45), so an array that contains itself recurses until the stack overflows. Cycles that pass through an object are detected, either throwing TypeError or returning '__cycle__' when `opts.cycles` is true. The README documents `cycles`, and the library mirrors JSON.stringify, which throws TypeError for this input, so the pure-array case is inconsistent and ignores `cycles`. The README wording ('circular property') and the exact expected output '["__cycle__"]' are the reporter's extrapolation, and it is an edge case that throws either way, which is why severity is low. A small fix (track arrays in `seen`) would be accepted.

A failing test reproduces it: `.counterhound/check/repro_array_cycle.test.mjs`. Run it with `./.counterhound/ph-test .counterhound/check/repro_array_cycle.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.counterhound/ph-test <test file>`).

counterhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.