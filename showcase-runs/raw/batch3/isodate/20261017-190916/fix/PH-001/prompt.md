You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
parse_time raises ValueError for hour fractions with many trailing 9s (microsecond rounds up to 1000000)
Function: isodate.isotime.parse_time (src/isodate/isotime.py:134)
Input: parse_time('00.9999999999999') (also '10.99999999999999')
Expected: A datetime.time just before the next hour (e.g. 00:59:59.999999), as the seconds/minutes branches do via ROUND_FLOOR
Actual: ValueError: microsecond must be in 0..999999
Why it is a bug: Docstring lists 'hh.hhTZD' with arbitrary decimal fraction as supported; the regex accepts any number of digits. The hour-fraction branch skips the ROUND_FLOOR quantize used by the minute/second branches and then calls to_integral() (rounding), so microsecond can become 1000000.
Reviewer: '10.99999999999999' matches the documented 'hh.hh' format, where the regex allows any number of fraction digits. In the hour-only branch (isotime.py:129-140), the seconds are never floored to 6 places like the second and minute branches do with ROUND_FLOOR. Instead, `microsecond.to_integral()` rounds up to 1000000, and `time()` raises a raw ValueError rather than returning 10:59:59.999999 or an ISO8601Error. A maintainer would accept a small fix that quantizes with ROUND_FLOOR, matching the sibling branches. The inputs are unusual, so impact is low.

A failing test reproduces it: `.proofhound/check/test_repro_hour_fraction_rounding.py`. Run it with `./.proofhound/ph-test .proofhound/check/test_repro_hour_fraction_rounding.py` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.