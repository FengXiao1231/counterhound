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
