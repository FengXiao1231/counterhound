You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with fast-check, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: src/index.ts
Functions (most promising first):
- `LRUCache.load(arr: [K, LRUCache.Entry<V>][])` (line 2113) — Reset the cache and load in the items in entries in the order listed.
- `LRUCache.dump()` (line 2080) — Return an array of [key, {@link LRUCache.Entry}] tuples which can be passed to {@link LRUCache#load}.
- `LRUCache.set(k: K, v: V | undefined, setOptions: LRUCache.SetOptions<K, V, FC> = {},)` (line 2160) — Add a value to the cache.
- `LRUCache.has(k: K, hasOptions: LRUCache.HasOptions<K, V, FC> = {})` (line 2407) — Check if a key is in the cache, without updating the recency of use. Will return false if the item is stale, even though it is technically in the cache.
- `LRUCache.get(k: K, getOptions: LRUCache.GetOptions<K, V, FC> = {})` (line 3007) — Return a value from the cache. Will update the recency of the cache entry found.
- `LRUCache.pop(): V | undefined` (line 2325) — Evict the least recently used item, returning its value or `undefined` if cache is empty.
- `LRUCache.peek(k: K, peekOptions: LRUCache.PeekOptions<K, V, FC> = {})` (line 2456) — Like {@link LRUCache#get} but doesn't update recency or delete stale items.
- `LRUCache.delete(k: K)` (line 3105) — Deletes a key out of the cache.

Stateful classes (test these as a whole: random sequences of the state-changing methods, checking what the reading methods promise after every step):
- `LRUCache(options: LRUCache.Options<K, V, FC> | LRUCache<K, V, FC>)`
  Default export, the thing you're using this module to get. The `K` and `V` types define the key and value types, respectively. The optional `FC` type defines the type of the `context` object passed to `cache.fetch()` and `cache.memo()`. Keys and values **must not** be `null` or `undefined`. All properties from the options object (with the exception of `max`, `maxSize`, `fetchMethod`, `memoMetho
  changes state: `purgeStale()`, `load(arr: [K, LRUCache.Entry<V>][])`, `pop(): V | undefined`, `memo(k: K, memoOptions: LRUCache.MemoOptions<K, V, FC> = {})`, `get(k: K, getOptions: LRUCache.GetOptions<K, V, FC> = {})`, `delete(k: K)`, `clear()`
  reads state: `getRemainingTTL(key: K)`, `entries()`, `rentries()`, `keys()`, `rkeys()`, `values()`, `rvalues()`, `info(key: K): LRUCache.Entry<V> | undefined`, `dump()`, `set(k: K, v: V | undefined, setOptions: LRUCache.SetOptions<K, V, FC> = {},)`, `has(k: K, hasOptions: LRUCache.HasOptions<K, V, FC> = {})`, `peek(k: K, peekOptions: LRUCache.PeekOptions<K, V, FC> = {})`, `fetch(k: K, fetchOptions: LRUCache.FetchOptions<K, V, FC> = {},): Promise<undefined | V>`, `forceFetch(k: K, fetchOptions: LRUCache.FetchOptions<K, V, FC> = {},): Promise<V>`

The project's own test helpers, which you may import (with a path relative to your test file) instead of building objects by hand: they know how to make valid instances, sessions or sample data.
- test/fixtures/expose.ts: `expose`

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261018-042240/g01-src-index-ts/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261018-042240/g01-src-index-ts/ph_props.test.mjs`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input". For a stateful class: a model-based test that drives random sequences of its methods and checks its invariants after every step (see the language notes).
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261018-042240/g01-src-index-ts/repro_<name>.test.mjs` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261018-042240/g01-src-index-ts/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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
  and import the code with a path relative to the test file, e.g. import { LRUCache } from '../../../../src/index.ts'. CommonJS modules can be imported the same way (default export = module.exports).
- One `test('name', () => { fc.assert(fc.property(arbs..., (args) => { assert... })); })` per property. Use `fc.pre(cond)` for preconditions.
- Repro files: `test('repro_<name>', () => { assert.deepEqual(fn(input), expected); })`, no fast-check, no randomness. A repro may import the project's test helpers listed above.
- Stateful classes (listed above, if any) get a model-based test with fast-check commands: each command checks a precondition on a simple model, runs one method on the real object and the model, and asserts what the class promises:
    class AddCmd { constructor(sku, price, qty) { Object.assign(this, { sku, price, qty }); }
      check() { return true; }
      run(model, real) { real.add(this.sku, this.price, this.qty); model[this.sku] = (model[this.sku] || 0) + this.qty; assert.equal(real.quantity(this.sku), model[this.sku]); }
      toString() { return `add(${this.sku}, ${this.price}, ${this.qty})`; } }
    test('cart model', () => {
      fc.assert(fc.property(fc.commands([fc.tuple(fc.constantFrom('a', 'b'), fc.nat(100), fc.integer({ min: 1, max: 5 })).map((a) => new AddCmd(...a))], { size: '+1' }),
        (cmds) => { fc.modelRun(() => ({ model: {}, real: new Cart() }), cmds); }));
    });
  Put the invariants (never negative, totals agree, size bookkeeping, repeated calls idempotent) in `run` after the call. The shrunk failure is the shortest command sequence: the repro is that sequence written out as plain calls, ending in the failing assertion.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.