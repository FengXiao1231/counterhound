You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
parseGoJson attributes a package-level panic to every earlier failed test, not just the unfinished one
Function: parseGoJson (src/lang/go.js)
Input: TestA: output '    a_test.go:3: got 1, want 2' then fail; TestB: run only; package-level output 'panic: boom'
Expected: TestA error = AssertionError 'got 1, want 2' (only the unfinished TestB may take the panic)
Actual: TestA error is re-parsed from its lines plus the package output and becomes type 'panic', message 'boom'
Why it is a bug: The comment says 'a panic printed after the test's own lines lands in package output', i.e. it is meant for the test that was running; but the condition only checks outcome === 'failed' and that the test's own lines lack 'panic:', so every failed test with a t.Error is overwritten.
Reviewer: The override at go.js:154 only checks that outcome is 'failed', that the test's own lines lack 'panic:', and that package output contains 'panic:'. It never checks whether the test finished. In `go test -json`, tests run sequentially, so a test that already got an explicit `fail` event has finished and cannot have caused a later panic. Its genuine t.Error message is replaced with type 'panic' and the other test's message. The code comment says the panic belongs to the test that was running, which is only the test with no outcome (the one set to 'failed' at line 147). Restricting the override to tests that had no explicit fail/pass event is a small fix a maintainer would accept. The repro matches the code path.

A failing test reproduces it: `.proofhound/check/repro_sibling_panic.test.mjs`. Run it with `./.proofhound/ph-test .proofhound/check/repro_sibling_panic.test.mjs` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (`./.proofhound/ph-test <test file>`).

proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.