You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with Hypothesis, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: num2words/base.py
Functions (most promising first):
- `Num2Word_Base.pluralize(self, n, forms)` (line 256) — Should resolve gettext form: http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
- `Num2Word_Base.to_currency(self, val, currency, cents, separator, adjective)` (line 272) — Args: val: Numeric value currency (str): Currency code cents (bool): Verbose cents separator (str): Cent separator adjective (bool): Prefix currency name with adjective Returns: str: Formatted string
- `Num2Word_Base.parse_minus(self, num_str)` (line 93) — Detach minus and return it as symbol with new num_str.
- `Num2Word_Base.splitnum(self, value)` (line 68)
- `Num2Word_Base.to_cardinal(self, value)` (line 103)
- `Num2Word_Base.to_cardinal_float(self, value)` (line 139)

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261017-191242/g02-num2words-base-py/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261017-191242/g02-num2words-base-py/test_ph_props.py`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input".
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261017-191242/g02-num2words-base-py/test_repro_<name>.py` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261017-191242/g02-num2words-base-py/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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

Language notes (Python + Hypothesis):
- Imports: the project root and src/ are on sys.path, so import the code like this: from num2words.base import Num2Word_Base.
- Use `from hypothesis import given, assume, example, settings, strategies as st` and plain `assert`.
- Property test names start with `test_`. Keep `max_examples` at the default unless a test is slow.
- Repro files are plain pytest: one function `def test_repro_<name>():` that calls the code with the concrete input and asserts the correct result. No Hypothesis, no randomness, no fixtures from the project unless needed.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.