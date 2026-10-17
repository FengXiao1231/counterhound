// Prompts for the two agent roles: the hunter (writes and runs property tests) and the
// skeptic (tries to refute each verified finding). Kept in one place so they are easy to tune.

const LANG_GUIDE = {
  python: ({ imports }) => `Language notes (Python + Hypothesis):
- Imports: the project root and src/ are on sys.path, so import the code like this: ${imports.join('; ')}.
- Use \`from hypothesis import given, assume, example, settings, strategies as st\` and plain \`assert\`.
- Property test names start with \`test_\`. Keep \`max_examples\` at the default unless a test is slow.
- Repro files are plain pytest: one function \`def test_repro_<name>():\` that calls the code with the concrete input and asserts the correct result. No Hypothesis, no randomness, no fixtures from the project unless needed.`,
  javascript: ({ imports }) => `Language notes (JavaScript/TypeScript + fast-check, run by node:test):
- Test files are ES modules. Start with:
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import fc from 'fast-check';
  and import the code with a path relative to the test file, e.g. ${imports.join('; ')}. CommonJS modules can be imported the same way (default export = module.exports).
- One \`test('name', () => { fc.assert(fc.property(arbs..., (args) => { assert... })); })\` per property. Use \`fc.pre(cond)\` for preconditions.
- Repro files: \`test('repro_<name>', () => { assert.deepEqual(fn(input), expected); })\`, no fast-check, no randomness.`,
};

const FINDING_SCHEMA = `{
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
}`;

export function hunterPrompt({ lang, group, workdir, testCmd, imports, notes }) {
  const files = lang.files();
  const fns = group.functions.map((f) => {
    const doc = f.doc ? ` — ${f.doc.split('\n').find((l) => l.trim()) || ''}`.slice(0, 160) : '';
    return `- \`${f.qualname}${f.signature}\` (line ${f.line})${doc}`;
  }).join('\n');
  return `You are proofhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with ${lang.framework}, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: ${group.file}
Functions (most promising first):
${fns}

## Hard rules
- Do not modify any project file. Create files only inside \`${workdir}/\`.
- Run tests only with: \`${testCmd} <file>\`, for example \`${testCmd} ${workdir}/${files.props}\`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no \`cd\`, pipes, redirections, \`&&\` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input".
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file \`${workdir}/${files.repro}\` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write \`${workdir}/findings.json\`: a JSON array (\`[]\` if you found nothing) of objects shaped like
${FINDING_SCHEMA}

Quality beats quantity: one real bug is worth more than five dubious ones, and an empty array is a fine answer. Every finding will be re-executed and then challenged by an independent reviewer, so do not report anything you cannot defend with evidence.

${LANG_GUIDE[lang.id]({ imports })}
${notes ? `\nProject notes from the user:\n${notes}\n` : ''}
When you are done, reply with one line: how many properties you tested and how many bugs you reported.`;
}

export function reviewerPrompt({ finding, verification, reproSource, testCmd, workdir, lang }) {
  const err = verification.error || {};
  const site = verification.site ? `${verification.site.file}:${verification.site.line}${verification.site.code ? ` (\`${verification.site.code}\`)` : ''}` : 'the test assertion';
  return `You are a skeptical, experienced maintainer of this project, reviewing an automated bug report. Most automated reports are wrong. Your job is to find the reason this one is wrong, and to accept it only if you cannot.

## The report
Title: ${finding.title}
Function: ${finding.function}
Property: ${finding.property}
Input: ${finding.input}
Expected: ${finding.expected}
Actual: ${finding.actual}
Reporter's evidence: ${finding.evidence}

## What proofhound verified by executing it
The repro below failed ${verification.runs}/${verification.runs} times in fresh processes with the same result:
${err.type}: ${String(err.message || '').slice(0, 600)}
Raised at: ${site}${verification.explicitRaise ? '\nNote: the error is raised deliberately by the project code (an explicit raise/throw). Decide whether that is documented, intended behaviour.' : ''}

Repro (${verification.reproFile}):
\`\`\`
${reproSource.slice(0, 5000)}
\`\`\`

## Check, in order
1. Is the input valid under the function's documented or clearly implied contract? Unspecified or excluded inputs mean "not a bug".
2. Is the expected behaviour actually promised (docstring, README, types, existing tests, how callers use it, strong language conventions), or is it the reporter's assumption?
3. Is the behaviour intentional: documented, tested elsewhere, or a deliberate exception?
4. Is the repro itself correct: right API usage, right comparison, no float-precision artefact?
5. Would a maintainer accept a fix?

Read the source and anything else you need. You may run \`${testCmd} ${workdir}/${verification.reproFile}\`. Do not edit files.

Reply with ONLY this JSON object:
{"verdict": "bug" | "not_a_bug" | "unclear", "confidence": 0.0-1.0, "severity": "low" | "medium" | "high", "category": "crash" | "wrong-result" | "contract-violation" | "inconsistency", "title": "a concise, neutral issue title", "reason": "two or three sentences a maintainer would find convincing", "maintainer_would_fix": true | false}`;
}
