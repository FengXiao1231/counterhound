You are proofhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with fast-check, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: src/diff.js
Functions (most promising first):
- `parseDiff(text)` (line 25) — Parse `git diff --unified=0` into Map(file -> [[start, end], ...]) of new-side lines.
- `touchedTargets(targets, changes)` (line 44) — Keep targets whose [line, line + loc) overlaps a changed range.
- `defaultBase(repo)` (line 5) — The ref to diff against when none is given: the PR base in GitHub Actions, else origin's default branch.
- `changedLines(repo, base)` (line 16) — Changed line ranges per file (repo-relative paths), from the merge base of `base` to the working tree.

## Hard rules
- Do not modify any project file. Create files only inside `.proofhound/runs/20261017-194852/g01-src-diff-js/`.
- Run tests only with: `./.proofhound/ph-test <file>`, for example `./.proofhound/ph-test .proofhound/runs/20261017-194852/g01-src-diff-js/ph_props.test.mjs`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input".
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.proofhound/runs/20261017-194852/g01-src-diff-js/repro_<name>.test.mjs` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.proofhound/runs/20261017-194852/g01-src-diff-js/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
{
  "title": "short issue title, e.g. 'chunk() drops the final partial chunk'",
  "function": "fully qualified function name",
  "kind": "crash | wrong-result | contract-violation | inconsistency",
  "property": "the property, in words, e.g. 'concatenating the chunks gives back the input'",
  "property_test": "name of the failing property test in the props file",
  "repro_file": "file name of the deterministic repro (inside the work dir)",
  "input": "the minimal concrete failing input",
  "expected": "what the correct behaviour is",
  "actual": "what happens instead",
  "evidence": "why the expected behaviour is really promised: quote the docstring/README/type/caller, or name the convention"
}

Quality beats quantity: one real bug is worth more than five dubious ones, and an empty array is a fine answer. Every finding will be re-executed and then challenged by an independent reviewer, so do not report anything you cannot defend with evidence.

Language notes (JavaScript/TypeScript + fast-check, run by node:test):
- Test files are ES modules. Start with:
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import fc from 'fast-check';
  and import the code with a path relative to the test file, e.g. import { parseDiff } from '../../../../src/diff.js'; import { touchedTargets } from '../../../../src/diff.js'; import { defaultBase } from '../../../../src/diff.js'. CommonJS modules can be imported the same way (default export = module.exports).
- One `test('name', () => { fc.assert(fc.property(arbs..., (args) => { assert... })); })` per property. Use `fc.pre(cond)` for preconditions.
- Repro files: `test('repro_<name>', () => { assert.deepEqual(fn(input), expected); })`, no fast-check, no randomness.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.