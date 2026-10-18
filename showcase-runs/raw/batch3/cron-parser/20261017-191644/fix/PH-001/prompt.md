You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; counterhound turns your edits into a patch.

## The bug
seededRandom('') treats an empty-string seed as omitted and returns a non-deterministic generator
Function: seededRandom (src/utils/random.ts)
Input: seededRandom('') called twice
Expected: Both generators yield the same sequence, since a seed string was provided (only an omitted seed should be random)
Actual: '' is falsy, so `str ? ... : Math.random()` picks a random seed and the sequences differ
Why it is a bug: Docstring: 'When not provided, the seed is randomly generated'; param type is `str?: string`, and '' is a provided string. Every other string seed is deterministic; the check should be `str === undefined`.
Reviewer: The docstring says the seed is random only 'when not provided', and the parameter is typed `str?: string`. The check `str ? ... : Math.random()` is a truthiness test, so a provided '' is treated like undefined. Every other string seed gives a deterministic sequence, and `hashSeed: ''` passed through CronExpressionParser.parse silently loses reproducibility. A maintainer would probably accept a one-line `str === undefined` fix, but '' is an edge-case seed and nothing in the tests or README promises how it behaves, so severity is low.

A failing test reproduces it: `.counterhound/check/repro_empty_seed.test.mjs`. Run it with `./.counterhound/ph-test .counterhound/check/repro_empty_seed.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.counterhound/ph-test <test file>`).

counterhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.