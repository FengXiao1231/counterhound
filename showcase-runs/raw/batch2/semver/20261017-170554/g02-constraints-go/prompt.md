You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with rapid, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: constraints.go
Functions (most promising first):
- `Constraints.Validate(v *Version) (bool, []error)` (line 117) — Validate checks if a version satisfies a constraint. If not a slice of reasons for the failure are returned in addition to a bool.
- `Constraints.UnmarshalText(text []byte) error` (line 176) — UnmarshalText implements the encoding.TextUnmarshaler interface.
- `Constraints.MarshalText() ([]byte, error)` (line 188) — MarshalText implements the encoding.TextMarshaler interface.
- `NewConstraint(c string) (*Constraints, error)` (line 41) — NewConstraint returns a Constraints instance that a Version instance can be checked against. If there is a parse error it will be returned.
- `Constraints.Check(v *Version) bool` (line 94) — Check tests if a version satisfies the constraints.

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261017-170554/g02-constraints-go/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261017-170554/g02-constraints-go/ph_props_test.go`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input".
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261017-170554/g02-constraints-go/repro_<name>_test.go` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261017-170554/g02-constraints-go/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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

Language notes (Go + rapid, run by go test):
- Test files are compiled into the package under test: package semver (tests are compiled into the package, so call (Constraints).Validate directly; import path github.com/Masterminds/semver/v3); package semver (tests are compiled into the package, so call (Constraints).UnmarshalText directly; import path github.com/Masterminds/semver/v3); package semver (tests are compiled into the package, so call (Constraints).MarshalText directly; import path github.com/Masterminds/semver/v3). Start every file with that `package` clause (no `_test` suffix), so exported and unexported identifiers can be used directly without an import.
- Name test functions `TestPh<Something>` and prefix any helper functions or types with `ph`, so nothing collides with the package's own code or tests.
- Property tests use rapid (import "pgregory.net/rapid"):
    func TestPhRoundTrip(t *testing.T) {
        rapid.Check(t, func(t *rapid.T) {
            s := rapid.String().Draw(t, "s")
            if got := Decode(Encode(s)); got != s { t.Fatalf("Decode(Encode(%q)) = %q", s, got) }
        })
    }
  Useful generators: rapid.Int(), rapid.IntRange(lo, hi), rapid.String(), rapid.StringMatching(re), rapid.SliceOf(g), rapid.SliceOfN(g, min, max), rapid.MapOf(k, v), rapid.SampledFrom(xs), rapid.Custom(fn). Skip invalid inputs with `t.Skip()` inside the property, or bound the generators.
- A panic in the code under test is reported with its location; a function returning an error where the contract says it succeeds is a failure you check with `if err != nil { t.Fatalf(...) }`.
- Repro files: `func TestReproXxx(t *testing.T)` with the concrete input, comparing with the expected value and calling `t.Fatalf` on mismatch. No rapid, math/rand or time.Now.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.