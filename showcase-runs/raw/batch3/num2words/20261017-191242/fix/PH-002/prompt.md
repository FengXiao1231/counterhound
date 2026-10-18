You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
BN to_cardinal drops leading zeros in the fractional part (1.05 reads the same as 1.5)
Function: num2words.lang_BN.Num2Word_BN.to_cardinal (num2words/lang_BN.py)
Input: to_cardinal('1.05')
Expected: a reading different from 1.5 (e.g. এক দশমিক শূন্য পাঁচ)
Actual: এক দশমিক পাঁচ (identical to 1.5)
Why it is a bug: parse_number converts the fractional string with int(), discarding leading zeros; _dosomik_to_bengali_word reads digit by digit, so the intent is digit-wise reading. 1.05 and 1.5 are different numbers.
Reviewer: The fraction is read digit by digit (`_dosomik_to_bengali_word` iterates `str(number)`, and the existing tests expect e.g. 1.11 -> 'এক এক'). But `parse_number` runs `int()` on the fractional digit string, which strips leading zeros, so 1.05 and 1.5 both give 'এক দশমিক পাঁচ'. This is a different number read aloud, and no test covers or intends it. A fix is easy: keep the fractional digits as a string and read them with the leading zeros included. `to_currency`/`parse_paisa` has its own separate handling, so the fix doesn't change that.

A failing test reproduces it: `.proofhound/check/test_repro_decimal_leading_zero.py`. Run it with `./.proofhound/ph-test .proofhound/check/test_repro_decimal_leading_zero.py` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.