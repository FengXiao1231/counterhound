You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with QuickTheories, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: src/main/java/org/apache/commons/csv/CSVFormat.java
Functions (most promising first):
- `CSVFormat.parse(final Reader reader): CSVParser` (line 2207) — Parses the specified content.
- `CSVFormat.format(final Object... values): String` (line 1754) — Formats the specified values as a CSV record string.
- `CSVFormat.newFormat(final char delimiter): CSVFormat` (line 1544) — Creates a new CSV format with the specified delimiter.
- `CSVFormat.withRecordSeparator(final char recordSeparator): CSVFormat` (line 3252) — Builds a new CSVFormat with the record separator of the format set to the specified character.
- `CSVFormat.withSystemRecordSeparator(): CSVFormat` (line 3315) — Builds a new CSVFormat with the record separator of the format set to the operating system's line separator string, typically CR+LF on Windows and LF on Linux.
- `CSVFormat.withEscape(final char escape): CSVFormat` (line 2924) — Builds a new CSVFormat with the escape character of the format set to the specified character.

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261017-192020/g01--main-java-org-apache-commons-csv-CSVFormat-java/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261017-192020/g01--main-java-org-apache-commons-csv-CSVFormat-java/PhPropsTest.java`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input".
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261017-192020/g01--main-java-org-apache-commons-csv-CSVFormat-java/Repro<Name>Test.java` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261017-192020/g01--main-java-org-apache-commons-csv-CSVFormat-java/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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

Language notes (Java + JUnit 5 + QuickTheories):
- Each test file is one class whose name matches the file name, in the package of the code under test: package org.apache.commons.csv; call new CSVFormat(...).parse(...) (or however instances are normally obtained); package org.apache.commons.csv; call new CSVFormat(...).format(...) (or however instances are normally obtained); package org.apache.commons.csv; call CSVFormat.newFormat(...). Being in the same package, it can use package-private members. The project's main classes and its dependencies are on the classpath.
- Property tests are JUnit 5 tests that run QuickTheories:
    import org.junit.jupiter.api.Test;
    import static org.junit.jupiter.api.Assertions.*;
    import static org.quicktheories.QuickTheory.qt;
    import static org.quicktheories.generators.SourceDSL.*;

    class PhPropsTest {
        @Test
        void roundTrip() {
            qt().forAll(strings().basicLatinAlphabet().ofLengthBetween(0, 20))
                .checkAssert(s -> assertEquals(s, Codec.decode(Codec.encode(s))));
        }
    }
  Generators: integers().all() / .between(a, b), longs(), doubles().between(a, b), strings().allPossible() / .basicLatinAlphabet() / .numeric() with .ofLengthBetween(a, b), lists().of(gen).ofSizeBetween(a, b), arbitrary().pick(a, b, c), booleans().all(), and gen.map(...) to build objects; forAll takes up to 4 generators. Use .assuming((a, b) -> cond) before checkAssert for preconditions. Prefer checkAssert with JUnit assertions over check(predicate): failures then say what differed.
- An exception from the project is reported with its source line; a documented exception (@throws) on invalid input is correct behaviour.
- Repro files: `class Repro<Name>Test` with a plain JUnit 5 `@Test` method calling the code with the concrete input and `assertEquals(expected, actual)`. No QuickTheories, Random or clocks.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.