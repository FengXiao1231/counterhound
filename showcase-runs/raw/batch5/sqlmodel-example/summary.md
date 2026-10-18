<!-- counterhound-report -->
### counterhound found 1 provable bug

Checked 5 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Tutorial app: PATCH /heroes/{id} with name or secret_name set to null returns 500 instead of a 4xx <sub>(wrong result, docs_src/tutorial/fastapi/app_testing/tutorial001_py310/main.py)</sub></summary>

| | |
|---|---|
| Function | `PATCH /heroes/{hero_id}` |
| Input | POST /heroes/ {"name":"a","secret_name":"b","age":null}, then PATCH /heroes/1 {"name": null} |
| Expected | 422 (or other 4xx), since name is a required non-null str on HeroBase; the hero is unchanged |
| Actual | 500 Internal Server Error: HeroUpdate accepts name=null, update_hero applies it with sqlmodel_update, and the commit raises IntegrityError (NOT NULL constraint  |
| Review | low severity, confidence 0.60 |

I read main.py, and `HeroUpdate` declares `name` and `secret_name` as `str \| None = None`, so `{"name": null}` passes validation. `model_dump(exclude_unset=True)` keeps the explicit null, `sqlmodel_update` sets it on the Hero, and the commit hits the NOT NULL constraint and returns 500, which matches the repro. A client error should get a 4xx, not a 500 that leaves the request unhandled. Against that, this is a simplified docs tutorial app rather than library code, so the maintainers may not think it needs changing.

Failing test (`test_repro_patch_null_name.py`, failed 3/3 runs):

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
</details>

<sub>15m11s · $0.42 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
