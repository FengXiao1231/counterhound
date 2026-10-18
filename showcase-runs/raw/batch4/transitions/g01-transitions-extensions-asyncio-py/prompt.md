You are proofhound's bug hunter. Find REAL bugs in the functions below by writing property-based tests with Hypothesis, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
File: transitions/extensions/asyncio.py
Functions (most promising first):
- `AsyncTimeout.on_timeout(self, value)` (line 736) — Listifies passed values and assigns them to on_timeout.
- `AsyncMachine.dispatch(self, trigger, *args, **kwargs)` (line 337) — Trigger an event on all models assigned to the machine. Args: trigger (str): Event name *args (list): List of arguments passed to the event trigger **kwargs (dict): Dictionary of keyword arguments passed to the event 
- `AsyncTimeout.create_timer(self, event_data)` (line 690) — Creates and returns a running timer. Shields self._process_timeout to prevent cancellation when transitioning away from the current state (which cancels the timer) while processing timeout callbacks. Args: event_data 
- `AsyncMachine.callback(self, func, event_data)` (line 353) — Trigger a callback function with passed event_data parameters. In case func is a string, the callable will be resolved from the passed model in event_data. This function is not intended to be called directly but throu
- `AsyncTimeout.enter(self, event_data)` (line 661) — Extends `transitions.core.State.enter` by starting a timeout timer for the current model when the state is entered and self.timeout is larger than 0.
- `AsyncMachine.cancel_running_transitions(self, model, msg)` (line 388) — This method is called by an `AsyncTransition` when all conditional tests have passed and the transition will happen. This requires already running tasks to be cancelled. Args: model (object): The currently processed m

Stateful classes (test these as a whole: random sequences of the state-changing methods, checking what the reading methods promise after every step):
- `AsyncTimeout(self, *args, **kwargs)`
  Adds timeout functionality to an asynchronous state. Timeouts are handled model-specific. Attributes: timeout (float): Seconds after which a timeout function should be called. on_timeout (list): Functions to call when a timeout is triggered. runner (dict): Keeps track of running timeout tasks to cancel when a state is exited.
  changes state: `enter(self, event_data)`, `on_timeout(self, value)`
  reads state: `exit(self, event_data)`, `create_timer(self, event_data)`
- `AsyncMachine(self, model, states, initial, transitions, send_event, auto_transitions, ordered_transitions, ignore_invalid_triggers, before_state_change, after_state_change, name, queued, prepare_event, finalize_event, model_attribute, model_override, on_exception, on_final, **kwargs)`
  Machine manages states, transitions and models. In case it is initialized without a specific model (or specifically no model), it will also act as a model itself. Machine takes also care of decorating models with conveniences functions related to added transitions and states during runtime. Attributes: states (OrderedDict): Collection of all registered states. events (dict): Collection of
  changes state: `add_model(self, model, initial)`, `process_context(self, func, model)`, `remove_model(self, model)`
  reads state: `dispatch(self, trigger, *args, **kwargs)`, `callbacks(self, funcs, event_data)`, `callback(self, func, event_data)`, `await_all(callables)`, `switch_model_context(self, model)`, `cancel_running_transitions(self, model, msg)`

The project's own test setup, which you may use (fixtures are available by name as test function arguments, exactly as in the project's tests; factories are imported from their file). Prefer them over building objects by hand: they know how to make valid users, orders, sessions or database rows. A fixture is set up per test, so in a property test either use it only for data that is not mutated, or add `@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])` and make the test reset what it changes.
- factory `MachineFactory` (transitions/extensions/factory.py): Convenience factory for machine class retrieval.
- factory `LockedHierarchicalMachine` (transitions/extensions/factory.py): A threadsafe hierarchical machine.
- factory `LockedGraphMachine` (transitions/extensions/factory.py): A threadsafe machine with graph support.
- factory `LockedHierarchicalGraphMachine` (transitions/extensions/factory.py): A threadsafe hierarchical machine with graph support.
- factory `AsyncGraphMachine` (transitions/extensions/factory.py): A machine that supports asynchronous event/callback processing with Graphviz support.
- factory `HierarchicalAsyncGraphMachine` (transitions/extensions/factory.py): A hierarchical machine that supports asynchronous event/callback processing with Graphviz support.

## Hard rules
- Do not modify any project file. Create files only inside `.proofhound/runs/20261018-041332/g01-transitions-extensions-asyncio-py/`.
- Run tests only with: `./.proofhound/ph-test <file>`, for example `./.proofhound/ph-test .proofhound/runs/20261018-041332/g01-transitions-extensions-asyncio-py/test_ph_props.py`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network.

## How to work
1. Read the target source, its docstrings and comments, type hints, the README/docs, and how the functions are called elsewhere in the project. Work out the intended contract: valid inputs, promised outputs, documented errors.
2. Write properties that the contract really implies. Strong kinds: round-trip (decode(encode(x)) == x), invariants (sorted, length or sum preserved, within bounds), idempotence (f(f(x)) == f(x)), agreement with a simple reference implementation you write, metamorphic relations, algebraic laws, and "does not crash on valid input". For a stateful class: a model-based test that drives random sequences of its methods and checks its invariants after every step (see the language notes).
3. Generate only valid inputs. Respect documented preconditions with strategy bounds or assume/pre. Do not report failures that depend on inputs the contract excludes or leaves unspecified. Raising a clear, documented exception on invalid input is correct behaviour, not a bug. Avoid NaN/infinity/float-precision noise and huge sizes unless the function claims to handle them.
   Be thorough: cover every listed function with several properties, and push on the edges the contract allows (empty and single-element inputs, boundaries, unicode, duplicates, negative numbers, unusual-but-valid combinations of options). Well-tested code hides its bugs in the corners.
4. Run the tests. For every failure decide: is my test wrong (fix it), is the input invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
5. For each genuine bug, write a deterministic repro file `.proofhound/runs/20261018-041332/g01-transitions-extensions-asyncio-py/test_repro_<name>.py` (one file per bug, standalone) with the minimal concrete input from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
6. Write `.proofhound/runs/20261018-041332/g01-transitions-extensions-asyncio-py/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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
- Imports: the project root and src/ are on sys.path, so import the code like this: from transitions.extensions.asyncio import AsyncTimeout; from transitions.extensions.asyncio import AsyncMachine.
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