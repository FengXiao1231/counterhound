You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with Hypothesis, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: ordered_set/__init__.py
Functions (most promising first):
- `OrderedSet.symmetric_difference(self, other: SetLike[T]) -> 'OrderedSet[T]'` (line 452) — Return the symmetric difference of two OrderedSets as a new set. That is, the new set will contain all elements that are in exactly one of the sets.
- `OrderedSet.difference(self, *sets) -> 'OrderedSet[T]'` (line 399) — Returns all elements that are in this set but not the others.
- `OrderedSet.difference_update(self, *sets) -> None` (line 482) — Update this OrderedSet to remove items from one or more other sets.
- `OrderedSet.union(self, *sets) -> 'OrderedSet[T]'` (line 351) — Combines all unique items. Each items order is defined by its first appearance.
- `OrderedSet.intersection(self, *sets) -> 'OrderedSet[T]'` (line 376) — Returns elements in common between all sets. Order is defined only by the first set.
- `OrderedSet.symmetric_difference_update(self, other: SetLike[T]) -> None` (line 518) — Update this OrderedSet to remove items from another set, then add items from the other set that were not present in this set.

Stateful classes (test these as a whole: random sequences of the state-changing methods, checking what the reading methods promise after every step):
- `OrderedSet(self, initial: OrderedSetInitializer[T])`
  An OrderedSet is a custom MutableSet that remembers its order, so that every entry has an index that can be looked up. Example: >>> OrderedSet([1, 1, 2, 3, 2]) OrderedSet([1, 2, 3])
  changes state: `add(self, key: T) -> int`, `pop(self, index: int) -> T`, `discard(self, key: T) -> None`, `clear(self) -> None`
  reads state: `copy(self) -> 'OrderedSet[T]'`, `update(self, sequence: SetLike[T]) -> int`, `index(self, key)`, `union(self, *sets) -> 'OrderedSet[T]'`, `intersection(self, *sets) -> 'OrderedSet[T]'`, `difference(self, *sets) -> 'OrderedSet[T]'`, `issubset(self, other: SetLike[T]) -> bool`, `issuperset(self, other: SetLike[T]) -> bool`, `symmetric_difference(self, other: SetLike[T]) -> 'OrderedSet[T]'`, `difference_update(self, *sets) -> None`, `intersection_update(self, other: SetLike[T]) -> None`, `symmetric_difference_update(self, other: SetLike[T]) -> None`

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261018-041233/g01-ordered_set-__init__-py/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261018-041233/g01-ordered_set-__init__-py/test_ph_props.py`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input". For a stateful class: a model-based test that drives random sequences of its methods and checks its invariants after every step (see the language notes).
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261018-041233/g01-ordered_set-__init__-py/test_repro_<name>.py` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261018-041233/g01-ordered_set-__init__-py/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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
- Imports: the project root and src/ are on sys.path, so import the code like this: from ordered_set import OrderedSet.
- Use `from hypothesis import given, assume, example, settings, strategies as st` and plain `assert`.
- Property test names start with `test_`. Keep `max_examples` at the default unless a test is slow.
- Repro files are plain pytest: one function `def test_repro_<name>():` that calls the code with the concrete input and asserts the correct result. No Hypothesis, no randomness. A repro may take a project fixture as an argument when the listed fixtures are the natural way to build the input.
- Stateful classes (listed above, if any) get a model-based test with `hypothesis.stateful`:
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
  Rules call the mutating methods on a fresh object, keeping a model alongside; invariants check what the class promises (consistency between queries, no negative totals, size bookkeeping, idempotence of repeated calls). Use `@precondition(lambda self: ...)` for rules that need state. The shrunk failure is printed as a sequence of steps: the repro is that sequence written out as a plain test, one call per line, ending in the failing assertion.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.