You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; counterhound turns your edits into a patch.

## The bug
fmtMs rounds seconds up to 60 without carrying (e.g. '1m60s', '60s')
Function: fmtMs (src/util.js)
Input: 119500 (also 59600)
Expected: '2m00s' (and '1m00s' for 59600)
Actual: '1m60s' (and '60s')
Why it is a bug: Time formats NmSS must have seconds in 00-59; Math.round(s % 60) and toFixed(0) can reach 60 without carrying.
Reviewer: In src/util.js, `fmtMs(119500)` floors minutes to 1 and then applies `Math.round(59.5)` to the seconds, which gives '1m60s' instead of '2m00s'. For `fmtMs(59600)`, `(59.6).toFixed(0)` gives '60s' instead of '1m00s'. The function formats durations as NmSS, where seconds are 00-59, so these outputs are invalid. The repro uses the function correctly and involves no float artefact. The fix is small: round the total to whole seconds before splitting into minutes and seconds. This is cosmetic, since it only affects log and report timing strings.

A failing test reproduces it: `.counterhound/check/repro_fmtms_rounding.test.mjs`. Run it with `./.counterhound/ph-test .counterhound/check/repro_fmtms_rounding.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.counterhound/ph-test <test file>`).

counterhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.