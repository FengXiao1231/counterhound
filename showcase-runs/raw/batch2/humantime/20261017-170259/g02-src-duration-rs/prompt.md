You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with proptest, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: src/duration.rs
Functions (most promising first):
- `parse_duration(s: &str) -> Result<Duration, Error>` (line 364) — Parse duration object `1hour 12min 5s`
- `format_duration(val: Duration) -> FormattedDuration` (line 392) — Formats duration into a human-readable string

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261017-170259/g02-src-duration-rs/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261017-170259/g02-src-duration-rs/ph_props.rs`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input".
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261017-170259/g02-src-duration-rs/repro_<name>.rs` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261017-170259/g02-src-duration-rs/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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

Language notes (Rust + proptest, run by cargo test):
- Each test file is compiled as an integration test of a separate crate that depends on the project, so only the PUBLIC API is reachable. Import it like this: use humantime::parse_duration; (re-exported at the crate root); use humantime::format_duration; (re-exported at the crate root). If a path does not resolve, read lib.rs for `pub mod` and `pub use` re-exports.
- Property tests use proptest:
    use proptest::prelude::*;
    proptest! {
        #[test]
        fn ph_round_trip(s in "[a-z]{0,20}", n in 0usize..100) {
            prop_assert_eq!(decode(&encode(&s)), s);
        }
    }
  Strategies: any::<T>(), ranges like 0i64..1000, regex strings like "\\PC*" (any non-control chars), proptest::collection::vec(strategy, 0..20), prop_oneof![...], Just(x). Use prop_assume!(cond) for preconditions.
- Check results with assert!/assert_eq!/prop_assert!/prop_assert_eq!. To check a Result the contract says is Ok, use `.unwrap()` or assert on it; do not use `.expect()`.
- Debug builds check integer overflow, so "attempt to add with overflow" inside the project is a panic on that input. Report it only if the input is valid under the contract.
- Repro files: plain `#[test] fn repro_<name>() { assert_eq!(f(input), expected); }`, no proptest, no randomness.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.