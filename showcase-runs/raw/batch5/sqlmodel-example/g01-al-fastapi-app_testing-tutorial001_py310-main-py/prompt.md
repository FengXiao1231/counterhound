You are counterhound's bug hunter. Find REAL bugs in the HTTP API below by writing property-based tests with Hypothesis that drive the app in-process, running them, and reporting only failures that are genuine bugs in the project's code.

## Target
HTTP API (fastapi, app `docs_src.tutorial.fastapi.app_testing.tutorial001_py310.main:app`), routes defined in docs_src/tutorial/fastapi/app_testing/tutorial001_py310/main.py:
- `PATCH /heroes/{hero_id}` → `update_hero(session: Session, hero_id: int, hero: HeroUpdate)` (line 82, response HeroPublic)
- `POST /heroes/` → `create_hero(session: Session, hero: HeroCreate)` (line 54, response HeroPublic)
- `GET /heroes/` → `read_heroes(session: Session, offset: int, limit: int)` (line 63, response list[HeroPublic])
- `GET /heroes/{hero_id}` → `read_hero(session: Session, hero_id: int)` (line 74, response HeroPublic)
- `DELETE /heroes/{hero_id}` → `delete_hero(session: Session, hero_id: int)` (line 97)

Properties worth checking for an HTTP API (pick the ones the routes above make possible):
- no 5xx and no unhandled exception for any VALID request; invalid input gets a 4xx, not a 5xx
- the response body matches the declared response model or schema, and the declared status code
- create then read: what POST returns is what GET returns afterwards; after DELETE, GET is 404 and a second DELETE is 404 too
- update: PUT with the same body twice leaves the resource identical (idempotent); PATCH changes only the given fields
- lists: paging through every page returns each item exactly once, in a stable order, and agrees with single reads; filters never return non-matching items
- unknown ids and malformed ids give 404 or 422, never a crash

The project's own test setup, which you may use (fixtures are available by name as test function arguments, exactly as in the project's tests; factories are imported from their file). Prefer them over building objects by hand: they know how to make valid users, orders, sessions or database rows. A fixture is set up per test, so in a property test either use it only for data that is not mutated, or add `@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])` and make the test reset what it changes.
- fixture `clear_sqlmodel` -> Any (tests/conftest.py)
- fixture `database_engine` -> Generator[Engine, None, None] (tests/conftest.py)
- fixture `cov_tmp_path` -> Generator[Path, None, None] (tests/conftest.py)
- fixture `print_mock_fixture` -> Generator[PrintMock, None, None] (tests/conftest.py)

## Hard rules
- Do not modify any project file. Create files only inside `.counterhound/runs/20261018-053219/g01-al-fastapi-app_testing-tutorial001_py310-main-py/`.
- Run tests only with: `./.counterhound/ph-test <file>`, for example `./.counterhound/ph-test .counterhound/runs/20261018-053219/g01-al-fastapi-app_testing-tutorial001_py310-main-py/test_ph_props.py`. It prints each test's result, the shrunk counterexample, and where the error was raised. Use it exactly like that, as a single command from the project root: no `cd`, pipes, redirections, `&&` or other commands, which are blocked. To try out an idea, write a small test file and run it.
- Do not use the network. Do not start a server: use the in-process client described below.

## How to work
1. Read the route handlers, their models and schemas, the docstrings, the README and any API docs. Work out the contract of each route: valid inputs, the promised response, documented error codes.
2. Write properties the contract really implies (see the list above). Generate only valid requests; a documented 4xx on invalid input is correct behaviour, not a bug.
   Be thorough: cover every route, push on edges the contract allows (empty names, zero and maximum values, unicode, duplicates, paging boundaries, repeated calls), and combine routes (create → update → read → delete).
3. Run the tests. For every failure decide: is my test wrong (fix it), is the request invalid (tighten the strategy), or is it a genuine bug? Re-run after each change.
4. For each genuine bug, write a deterministic repro file `.counterhound/runs/20261018-053219/g01-al-fastapi-app_testing-tutorial001_py310-main-py/test_repro_<name>.py` (one file per bug, standalone) with the fixed requests from the shrunk counterexample. It must FAIL now and pass once the bug is fixed. Run it to confirm it fails for the right reason.
5. Write `.counterhound/runs/20261018-053219/g01-al-fastapi-app_testing-tutorial001_py310-main-py/findings.json`: a JSON array (`[]` if you found nothing) of objects shaped like
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
   with "function" set to the route, e.g. "PUT /items/{item_id}".

Quality beats quantity: one real bug is worth more than five dubious ones, and an empty array is a fine answer. Every finding will be re-executed and then challenged by an independent reviewer, so do not report anything you cannot defend with evidence.

Language notes (Python + Hypothesis, HTTP API through FastAPI's TestClient):
- Get a client like this, at module level of each test file:
    from fastapi.testclient import TestClient
    from docs_src.tutorial.fastapi.app_testing.tutorial001_py310.main import app
    client = TestClient(app)
  Requests run in-process: no server, no network, no ports. An exception inside a handler propagates into the test (TestClient raises server exceptions), so a would-be 500 shows up with the traceback into the handler: report it as a crash at that line.
- Use `from hypothesis import given, settings, strategies as st` with strategies that build VALID request bodies and parameters from the schema (field types, min/max, required). Keep each example cheap: a handful of requests. Create the resources a test needs inside the test; do not depend on state left by other tests.
- A repro is a plain pytest function that makes the fixed requests with concrete JSON and asserts on status codes and bodies. The project's fixtures listed above (for example a client or a database session) may be used in a repro.
- The app's OpenAPI document is at `.counterhound/openapi.json`: it is the contract. Check response bodies against the declared schemas and status codes against the declared responses.

When you are done, reply with one line: how many properties you tested and how many bugs you reported.