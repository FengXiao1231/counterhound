// Prompts for the two agent roles: the hunter (writes and runs property tests) and the
// skeptic (tries to refute each verified finding). Kept in one place so they are easy to tune.

const LANG_GUIDE = {
  python: ({ imports }) => `Language notes (Python + Hypothesis):
- Imports: the project root and src/ are on sys.path, so import the code like this: ${imports.join('; ')}.
- Use \`from hypothesis import given, assume, example, settings, strategies as st\` and plain \`assert\`.
- Property test names start with \`test_\`. Keep \`max_examples\` at the default unless a test is slow.
- Repro files are plain pytest: one function \`def test_repro_<name>():\` that calls the code with the concrete input and asserts the correct result. No Hypothesis, no randomness. A repro may take a project fixture as an argument when the listed fixtures are the natural way to build the input.
- Stateful classes (listed above, if any) get a model-based test with \`hypothesis.stateful\`:
    from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, precondition, initialize
    class CartMachine(RuleBasedStateMachine):
        def __init__(self):
            super().__init__()
            self.cart = Cart()
            self.model = {}            # a simple model of what the state should be
        @rule(sku=st.sampled_from(['a', 'b']), price=st.integers(0, 100), qty=st.integers(1, 5))
        def add(self, sku, price, qty):
            self.cart.add(sku, price, qty)
            self.model[sku] = (price, self.model.get(sku, (0, 0))[1] + qty)
        @invariant()
        def total_matches_model(self):
            assert self.cart.total() == sum(p * q for p, q in self.model.values())
    TestCart = CartMachine.TestCase
  Rules call the mutating methods on a fresh object, keeping a model alongside; invariants check what the class promises (consistency between queries, no negative totals, size bookkeeping, idempotence of repeated calls). Use \`@precondition(lambda self: ...)\` for rules that need state. The shrunk failure is printed as a sequence of steps: the repro is that sequence written out as a plain test, one call per line, ending in the failing assertion.`,
  javascript: ({ imports }) => `Language notes (JavaScript/TypeScript + fast-check, run by node:test):
- Test files are ES modules. Start with:
    import test from 'node:test';
    import assert from 'node:assert/strict';
    import fc from 'fast-check';
  and import the code with a path relative to the test file, e.g. ${imports.join('; ')}. CommonJS modules can be imported the same way (default export = module.exports).
- One \`test('name', () => { fc.assert(fc.property(arbs..., (args) => { assert... })); })\` per property. Use \`fc.pre(cond)\` for preconditions.
- Repro files: \`test('repro_<name>', () => { assert.deepEqual(fn(input), expected); })\`, no fast-check, no randomness. A repro may import the project's test helpers listed above.
- Stateful classes (listed above, if any) get a model-based test with fast-check commands: each command checks a precondition on a simple model, runs one method on the real object and the model, and asserts what the class promises:
    class AddCmd { constructor(sku, price, qty) { Object.assign(this, { sku, price, qty }); }
      check() { return true; }
      run(model, real) { real.add(this.sku, this.price, this.qty); model[this.sku] = (model[this.sku] || 0) + this.qty; assert.equal(real.quantity(this.sku), model[this.sku]); }
      toString() { return \`add(\${this.sku}, \${this.price}, \${this.qty})\`; } }
    test('cart model', () => {
      fc.assert(fc.property(fc.commands([fc.tuple(fc.constantFrom('a', 'b'), fc.nat(100), fc.integer({ min: 1, max: 5 })).map((a) => new AddCmd(...a))], { size: '+1' }),
        (cmds) => { fc.modelRun(() => ({ model: {}, real: new Cart() }), cmds); }));
    });
  Put the invariants (never negative, totals agree, size bookkeeping, repeated calls idempotent) in \`run\` after the call. The shrunk failure is the shortest command sequence: the repro is that sequence written out as plain calls, ending in the failing assertion.`,
  go: ({ imports }) => `Language notes (Go + rapid, run by go test):
- Test files are compiled into the package under test: ${imports.join('; ')}. Start every file with that \`package\` clause (no \`_test\` suffix), so exported and unexported identifiers can be used directly without an import.
- Name test functions \`TestPh<Something>\` and prefix any helper functions or types with \`ph\`, so nothing collides with the package's own code or tests.
- Property tests use rapid (import "pgregory.net/rapid"):
    func TestPhRoundTrip(t *testing.T) {
        rapid.Check(t, func(t *rapid.T) {
            s := rapid.String().Draw(t, "s")
            if got := Decode(Encode(s)); got != s { t.Fatalf("Decode(Encode(%q)) = %q", s, got) }
        })
    }
  Useful generators: rapid.Int(), rapid.IntRange(lo, hi), rapid.String(), rapid.StringMatching(re), rapid.SliceOf(g), rapid.SliceOfN(g, min, max), rapid.MapOf(k, v), rapid.SampledFrom(xs), rapid.Custom(fn). Skip invalid inputs with \`t.Skip()\` inside the property, or bound the generators.
- A panic in the code under test is reported with its location; a function returning an error where the contract says it succeeds is a failure you check with \`if err != nil { t.Fatalf(...) }\`.
- Repro files: \`func TestReproXxx(t *testing.T)\` with the concrete input, comparing with the expected value and calling \`t.Fatalf\` on mismatch. No rapid, math/rand or time.Now.`,
  rust: ({ imports }) => `Language notes (Rust + proptest, run by cargo test):
- Each test file is compiled as an integration test of a separate crate that depends on the project, so only the PUBLIC API is reachable. Import it like this: ${imports.join('; ')}. If a path does not resolve, read lib.rs for \`pub mod\` and \`pub use\` re-exports.
- Property tests use proptest:
    use proptest::prelude::*;
    proptest! {
        #[test]
        fn ph_round_trip(s in "[a-z]{0,20}", n in 0usize..100) {
            prop_assert_eq!(decode(&encode(&s)), s);
        }
    }
  Strategies: any::<T>(), ranges like 0i64..1000, regex strings like "\\\\PC*" (any non-control chars), proptest::collection::vec(strategy, 0..20), prop_oneof![...], Just(x). Use prop_assume!(cond) for preconditions.
- Check results with assert!/assert_eq!/prop_assert!/prop_assert_eq!. To check a Result the contract says is Ok, use \`.unwrap()\` or assert on it; do not use \`.expect()\`.
- Debug builds check integer overflow, so "attempt to add with overflow" inside the project is a panic on that input. Report it only if the input is valid under the contract.
- Repro files: plain \`#[test] fn repro_<name>() { assert_eq!(f(input), expected); }\`, no proptest, no randomness.`,
  java: ({ imports }) => `Language notes (Java + JUnit 5 + QuickTheories):
- Each test file is one class whose name matches the file name, in the package of the code under test: ${imports.join('; ')}. Being in the same package, it can use package-private members. The project's main classes and its dependencies are on the classpath.
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
- Repro files: \`class Repro<Name>Test\` with a plain JUnit 5 \`@Test\` method calling the code with the concrete input and \`assertEquals(expected, actual)\`. No QuickTheories, Random or clocks.`,
};

const API_GUIDE = {
  python: (api) => `Language notes (Python + Hypothesis, HTTP API through ${api.framework === 'fastapi' ? 'FastAPI\'s TestClient' : 'Flask\'s test client'}):
- Get a client like this, at module level of each test file:
    ${api.client.split('\n').join('\n    ')}
  Requests run in-process: no server, no network, no ports. ${api.framework === 'fastapi' ? 'An exception inside a handler propagates into the test (TestClient raises server exceptions), so a would-be 500 shows up with the traceback into the handler: report it as a crash at that line.' : 'With TESTING on, an exception inside a view propagates into the test, so a would-be 500 shows up with the traceback into the view.'}
- Use \`from hypothesis import given, settings, strategies as st\` with strategies that build VALID request bodies and parameters from the schema (field types, min/max, required). Keep each example cheap: a handful of requests. Create the resources a test needs inside the test; do not depend on state left by other tests.
- A repro is a plain pytest function that makes the fixed requests with concrete JSON and asserts on status codes and bodies. The project's fixtures listed above (for example a client or a database session) may be used in a repro.${api.openapiPath ? `\n- The app's OpenAPI document is at \`${api.openapiPath}\`: it is the contract. Check response bodies against the declared schemas and status codes against the declared responses.` : ''}`,
  javascript: (api) => `Language notes (JavaScript/TypeScript + fast-check, HTTP API through ${api.framework}):
- Get a client like this:
    ${api.client.split('\n').join('\n    ')}
- Use fc.assert(fc.asyncProperty(...)) with arbitraries that build VALID request bodies from the schema or the handler's validation. Keep each example cheap. Create what a test needs inside the test.
- A repro is a plain \`test('repro_<name>', async () => { ... })\` making the fixed requests with concrete JSON and asserting on status codes and bodies. A 5xx response is a bug: assert on the status so the failure is attributed to that request.`,
};

function apiSection(group, api) {
  const routes = group.functions.map((f) => {
    const doc = f.doc ? ` — ${f.doc.trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ')}`.slice(0, 240) : '';
    const extra = [f.route.responseModel && `response ${f.route.responseModel}`, f.route.statusCode && `status ${f.route.statusCode}`].filter(Boolean).join(', ');
    return `- \`${f.route.method} ${f.route.path}\` → \`${f.route.handler}${f.signature.replace(/^ → [^(]+/, '')}\` (line ${f.line}${extra ? `, ${extra}` : ''})${doc}`;
  }).join('\n');
  return `## Target
HTTP API (${api.framework}${api.app ? `, app \`${api.app.module}:${api.app.name}${api.app.factory ? '()' : ''}\`` : ''}), routes defined in ${group.file}:
${routes}

Properties worth checking for an HTTP API (pick the ones the routes above make possible):
- no 5xx and no unhandled exception for any VALID request; invalid input gets a 4xx, not a 5xx
- the response body matches the declared response model or schema, and the declared status code
- create then read: what POST returns is what GET returns afterwards; after DELETE, GET is 404 and a second DELETE is 404 too
- update: PUT with the same body twice leaves the resource identical (idempotent); PATCH changes only the given fields
- lists: paging through every page returns each item exactly once, in a stable order, and agrees with single reads; filters never return non-matching items
- unknown ids and malformed ids give 404 or 422, never a crash`;
}

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

function statefulSection(group) {
  if (!group.classes?.length) return '';
  const one = (cls) => {
    const doc = cls.doc ? `\n  ${cls.doc.trim().replace(/\s*\n\s*/g, ' ').slice(0, 400)}` : '';
    return `- \`${cls.name}${cls.init}\`${doc}\n  changes state: ${cls.mutators.map((m) => `\`${m}\``).join(', ') || 'none'}\n  reads state: ${cls.queries.map((m) => `\`${m}\``).join(', ') || 'none'}`;
  };
  return `
Stateful classes (test these as a whole: random sequences of the state-changing methods, checking what the reading methods promise after every step):
${group.classes.map(one).join('\n')}
`;
}

function fixtureSection(fixtures) {
  if (!fixtures || (!fixtures.fixtures?.length && !fixtures.factories?.length && !fixtures.helpers?.length)) return '';
  if (!fixtures.fixtures?.length && !fixtures.factories?.length) {
    return `
The project's own test helpers, which you may import (with a path relative to your test file) instead of building objects by hand: they know how to make valid instances, sessions or sample data.
${fixtures.helpers.map((h) => `- ${h.file}: ${h.exports.map((n) => `\`${n}\``).join(', ')}`).join('\n')}
`;
  }
  const fx = (fixtures.fixtures || []).slice(0, 25).map((f) => `- fixture \`${f.name}\`${f.returns ? ` -> ${f.returns}` : ''} (${f.file}${f.scope !== 'function' ? `, ${f.scope} scope` : ''})${f.doc ? `: ${f.doc}` : ''}`);
  const fac = (fixtures.factories || []).slice(0, 25).map((f) => `- factory \`${f.name}\`${f.model ? ` for ${f.model}` : ''} (${f.file})${f.doc ? `: ${f.doc}` : ''}`);
  return `
The project's own test setup, which you may use (fixtures are available by name as test function arguments, exactly as in the project's tests; factories are imported from their file). Prefer them over building objects by hand: they know how to make valid users, orders, sessions or database rows. A fixture is set up per test, so in a property test either use it only for data that is not mutated, or add \`@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])\` and make the test reset what it changes.
${[...fx, ...fac].join('\n')}
`;
}

export function hunterPrompt({ lang, group, workdir, testCmd, imports, notes, fixtures, api }) {
  const files = lang.files();
  if (api) return hunterApiPrompt({ lang, group, workdir, testCmd, notes, fixtures, api, files });
  const fns = group.functions.map((f) => {
    const doc = f.doc ? ` — ${f.doc.trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ')}`.slice(0, 220) : '';
    return `- \`${f.qualname}${f.signature}\` (line ${f.line})${doc}`;
  }).join('\n');
  return `You are proofhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with ${lang.framework}, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: ${group.file}
Functions (most promising first):
${fns}
${statefulSection(group)}${fixtureSection(fixtures)}
## Hard rules
- Do not modify any project file. Create files only inside \`${workdir}/\`.
- Run tests only with: \`${testCmd} <file>\`, for example \`${testCmd} ${workdir}/${files.props}\`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no \`cd\`, pipes, redirections, \`&&\` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input". For a stateful class: a model-based test that drives random sequences of its methods and checks its invariants after every step (see the language notes).
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

function hunterApiPrompt({ lang, group, workdir, testCmd, notes, fixtures, api, files }) {
  return `You are proofhound's bug hunter. Find REAL bugs in the HTTP API below by writing property-based tests with ${lang.framework} that drive the app in-process, running them, and reporting only failures that are genuine bugs in the project's code.

${apiSection(group, api)}
${fixtureSection(fixtures)}
## Hard rules
- Do not modify any project file. Create files only inside \`${workdir}/\`.
- Run tests only with: \`${testCmd} <file>\`, for example \`${testCmd} ${workdir}/${files.props}\`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no \`cd\`, pipes, redirections, \`&&\` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network. Do not start a server: use the in-process client described below.

## How to work
1. Read the route handlers, their models and schemas, the docstrings, the README and any API docs. Work out the contract of each route: valid inputs, the promised response, documented error codes.
2. Write properties the contract really implies (see the list above). Generate only valid requests; a documented 4xx on invalid input is correct behaviour, not a bug.
   Be thorough: cover every route, push on edges the contract allows (empty names, zero and maximum values, unicode, duplicates, paging boundaries, repeated calls), and combine routes (create → update → read → delete).
3. Run the tests. For every failure decide: is my test wrong (fix it), is the request invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
4. For each genuine bug, write a deterministic repro file \`${workdir}/${files.repro}\` (one file per bug, standalone) with the fixed requests from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
5. Write \`${workdir}/findings.json\`: a JSON array (\`[]\` if you found nothing) of objects shaped like
${FINDING_SCHEMA}
   with "function" set to the route, e.g. "PUT /items/{item_id}".

Quality beats quantity: one real bug is worth more than five dubious ones, and an empty array is a fine answer. Every finding will be re-executed and then challenged by an independent reviewer, so do not report anything you cannot defend with evidence.

${API_GUIDE[lang.id](api)}
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

export function fixerPrompt({ bug, lang, reproRel, testCmd, notes }) {
  const v = bug.verification;
  const r = bug.review || {};
  const where = v.site ? `${v.site.file}:${v.site.line}` : bug.file;
  return `You are fixing a confirmed bug. The current directory is a disposable copy of the project: edit its source files directly. Nothing you change here touches the real project; proofhound turns your edits into a patch.

## The bug
${r.title || bug.title}
Function: ${bug.function} (${where})
Input: ${bug.input}
Expected: ${bug.expected}
Actual: ${v.kind === 'assertion' ? bug.actual : `${v.error.type}: ${String(v.error.message).split('\n')[0].slice(0, 300)}`}
Why it is a bug: ${bug.evidence || ''}${r.reason ? `\nReviewer: ${r.reason}` : ''}

A failing test reproduces it: \`${reproRel}\`. Run it with \`${testCmd} ${reproRel}\` (a single command, no cd, pipes or &&).

## What to do
1. Read the code and find the root cause. Fix the cause, not this one input: the same bug for similar inputs must also be gone.
2. Make the smallest change a maintainer would accept: same style, no refactoring, no new dependencies, no unrelated edits. Keep every documented behaviour that is not part of the bug.
3. Do not edit or delete the repro, and do not change or skip the project's existing tests to make anything pass. You may add a regression test next to the project's existing tests if that is how the project is tested.
4. Run the repro until it passes. If you can, also run nearby existing tests the same way (\`${testCmd} <test file>\`).
${notes ? `\nProject notes from the user:\n${notes}\n` : ''}
proofhound will re-run the repro and the project's test suite on your change and drop it if either fails. When you are done, reply with one or two sentences describing the fix.`;
}
