You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
Singular unit not chosen for negative sizes with magnitude 1.x (-1 formats as "-1 Bytes")
Function: humansize::ISizeFormatter::fmt (the body behind FormatSizeI::format_size_i; the impl_style feature is not enabled in the harness so the wrapper itself could not be called) (src/impl_style.rs)
Input: (-1i64).format_size_i(DECIMAL.long_units(true).space_after_value(true)), i.e. ISizeFormatter::new(-1i64, opts)
Expected: "-1 Byte" (singular, like "1 Byte")
Actual: "-1 Bytes"
Why it is a bug: formatters.rs says 'Remove "s" from the scale if the size is 1.x' but the check f64_eq(ipart, 1.0) uses the signed integer part, so it never fires for -1.x. Same for -1 kB-scale values, e.g. -1000 long decimal gives "-1 Kilobytes" vs "1 Kilobyte". Negation symmetry is the natural contract of format_size_i, whose docs show 1_000_000 -> "1 MB" and -1_000_000 -> "-1 MB".
Reviewer: The code comment says the "s" is removed when the size is 1.x, and the rest of ISizeFormatter works on magnitude (fabs for scale selection and integer-part rendering). The plural check `f64_eq(ipart, 1.0)` uses the signed `modf` integer part, so it never fires for negative values. The result is that 1 gives "1 Byte" and -1 gives "-1 Bytes", which is an unintended asymmetry. The fix is a one-line `fabs(ipart)`, and no test or doc requires "-1 Bytes". The only doubt is that "-1 bytes" is arguably acceptable English, and the effect is limited to long units and bit-scale 0 with negative inputs.

A failing test reproduces it: `.proofhound/check/repro_negative_one_plural.rs`. Run it with `./.proofhound/ph-test .proofhound/check/repro_negative_one_plural.rs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.