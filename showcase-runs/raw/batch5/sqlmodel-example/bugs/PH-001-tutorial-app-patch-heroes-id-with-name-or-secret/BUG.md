# Tutorial app: PATCH /heroes/{id} with name or secret_name set to null returns 500 instead of a 4xx

| | |
|---|---|
| Function | `PATCH /heroes/{hero_id}` in `docs_src/tutorial/fastapi/app_testing/tutorial001_py310/main.py` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** POST /heroes/ {"name":"a","secret_name":"b","age":null}, then PATCH /heroes/1 {"name": null}

**Expected:** 422 (or other 4xx), since name is a required non-null str on HeroBase; the hero is unchanged

**Actual:** 500 Internal Server Error: HeroUpdate accepts name=null, update_hero applies it with sqlmodel_update, and the commit raises IntegrityError (NOT NULL constraint failed: hero.name). The same applies to secret_name.

## Reproduce

```python
import importlib

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from docs_src.tutorial.fastapi.app_testing.tutorial001_py310 import main as _main


def test_patch_null_name_is_not_a_server_error(clear_sqlmodel):
    main = importlib.reload(_main)
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    def override():
        with Session(engine) as s:
            yield s

    main.app.dependency_overrides[main.get_session] = override
    client = TestClient(main.app, raise_server_exceptions=False)
    pr = client.post("/heroes/", json={"name": "a", "secret_name": "b", "age": None})
    assert pr.status_code == 200, (pr.status_code, pr.text)
    h = pr.json()
    r = client.patch(f"/heroes/{h['id']}", json={"name": None})
    assert r.status_code < 500, (r.status_code, r.text)
```

Fails with `AssertionError: (500, 'Internal Server Error')`

Save it as `test_repro_patch_null_name.py` in your tests and run `pytest test_repro_patch_null_name.py`.

## Why this is a bug

HeroBase declares name: str and secret_name: str (non-optional), and the DB column is NOT NULL, but HeroUpdate declares them as `str | None = None`, so the request validates and then fails in the handler at session.commit() in update_hero (main.py line 91). Invalid input should be a 4xx, not a 5xx.

Independent review: I read main.py, and `HeroUpdate` declares `name` and `secret_name` as `str | None = None`, so `{"name": null}` passes validation. `model_dump(exclude_unset=True)` keeps the explicit null, `sqlmodel_update` sets it on the Hero, and the commit hits the NOT NULL constraint and returns 500, which matches the repro. A client error should get a 4xx, not a 500 that leaves the request unhandled. Against that, this is a simplified docs tutorial app rather than library code, so the maintainers may not think it needs changing.

## How it was found

Property: *a well-formed PATCH request never causes a 5xx; invalid input yields a 4xx*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
