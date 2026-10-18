You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; counterhound turns your edits into a patch.

## The bug
stringifyPath emits an unparseable index like "[1e+21]" for integer numbers >= 1e21
Function: stringifyPath (index.js)
Input: stringifyPath([1e21])
Expected: a path string that parsePath accepts (e.g. the number treated as a string key like '1e\+21'/escaped, or a digit-only index)
Actual: returns '[1e+21]', and parsePath('[1e+21]') throws "Invalid character 'e' in an index at position 3"
Why it is a bug: readme: stringifyPath 'Returns a string path that can be used with other dot-prop functions'; type is Array<string | number>. Number.isInteger(1e21) is true so formatPathSegment uses `[${segment}]`, which stringifies in exponent notation.
Reviewer: formatPathSegment sends every non-negative integer to bracket notation via `[${segment}]`. For values >= 1e21, `String(n)` switches to exponent notation, so the output contains 'e' and '+', and parsePath rejects it. The function already sends non-integers and negatives down the escaped-string-key path precisely so the output stays parseable, so this case is an overlooked edge of the same rule. A maintainer would likely accept a small fix, such as treating numbers whose string form is not all digits as string keys. The input is an extreme edge case, so severity is low.

A failing test reproduces it: `.counterhound/check/repro_large_number_segment.test.mjs`. Run it with `./.counterhound/ph-test .counterhound/check/repro_large_number_segment.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.counterhound/ph-test <test file>`).

counterhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.