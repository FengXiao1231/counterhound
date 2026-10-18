You are counterhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with Hypothesis, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: src/sortedcontainers/sortedlist.py
Functions (most promising first):
- `SortedList.bisect_left(self, value)` (line 1085) — Return an index to insert `value` in the sorted list.
- `SortedList.bisect_right(self, value)` (line 1116) — Return an index to insert `value` in the sorted list.
- `SortedKeyList.update(self, iterable)` (line 1759) — Update sorted-key list by adding all values from `iterable`.
- `SortedKeyList.bisect_left(self, value)` (line 2130) — Return an index to insert `value` in the sorted-key list.
- `SortedKeyList.bisect_right(self, value)` (line 2151) — Return an index to insert `value` in the sorted-key list.
- `SortedKeyList.bisect_key_left(self, key)` (line 2174) — Return an index to insert `key` in the sorted-key list.

Stateful classes (test these as a whole: random sequences of the state-changing methods, checking what the reading methods promise after every step):
- `SortedList(self, iterable, key)`
  Sorted list is a sorted mutable sequence. Sorted list values are maintained in sorted order. Sorted list values must be comparable. The total ordering of values must not change while they are stored in the sorted list. Methods for adding values: * :func:`SortedList.add` * :func:`SortedList.update` * :func:`SortedList.__add__` * :func:`SortedList.__iadd__` * :func:`SortedList.__mul__` * :func:`
  changes state: `clear(self)`, `add(self, value)`, `update(self, iterable)`
  reads state: `discard(self, value)`, `remove(self, value)`, `reverse(self)`, `islice(self, start, stop, reverse)`, `irange(self, minimum, maximum, inclusive, reverse)`, `bisect_left(self, value)`, `bisect_right(self, value)`, `count(self, value)`, `copy(self)`, `append(self, value)`, `extend(self, values)`, `insert(self, index, value)`, `pop(self, index)`, `index(self, value, start, stop)`
- `SortedKeyList(self, iterable, key)`
  Sorted-key list is a subtype of sorted list. The sorted-key list maintains values in comparison order based on the result of a key function applied to every value. All the same methods that are available in :class:`SortedList` are also available in :class:`SortedKeyList`. Additional methods provided: * :attr:`SortedKeyList.key` * :func:`SortedKeyList.bisect_key_left` * :func:`SortedKeyList.bis
  changes state: `clear(self)`, `add(self, value)`, `update(self, iterable)`
  reads state: `discard(self, value)`, `remove(self, value)`, `irange(self, minimum, maximum, inclusive, reverse)`, `irange_key(self, min_key, max_key, inclusive, reverse)`, `bisect_left(self, value)`, `bisect_right(self, value)`, `bisect_key_left(self, key)`, `bisect_key_right(self, key)`, `count(self, value)`, `copy(self)`, `index(self, value, start, stop)`

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261018-041057/g02-src-sortedcontainers-sortedlist-py/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261018-041057/g02-src-sortedcontainers-sortedlist-py/test_ph_props.py`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input". For a stateful class: a model-based test that drives random sequences of its methods and checks its invariants after every step (see the language notes).
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261018-041057/g02-src-sortedcontainers-sortedlist-py/test_repro_<name>.py` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.counterhound/runs/20261018-041057/g02-src-sortedcontainers-sortedlist-py/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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
- Imports: the project root and src/ are on sys.path, so import the code like this: from sortedcontainers.sortedlist import SortedList; from sortedcontainers.sortedlist import SortedKeyList.
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