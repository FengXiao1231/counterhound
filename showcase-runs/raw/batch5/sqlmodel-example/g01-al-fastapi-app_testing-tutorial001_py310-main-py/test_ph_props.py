import importlib

from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings, strategies as st
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from docs_src.tutorial.fastapi.app_testing.tutorial001_py310 import main as _main

SET = settings(
    max_examples=15,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)

text = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="\x00"),
    max_size=20,
)
age = st.none() | st.integers(min_value=-(2**31), max_value=2**31)
hero_body = st.fixed_dictionaries({"name": text, "secret_name": text, "age": age})


class Ctx:
    def __init__(self):
        if "hero" in SQLModel.metadata.tables:
            self.main = _main
        else:
            self.main = importlib.reload(_main)

    def new_client(self):
        main = self.main
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        engine.echo = False
        SQLModel.metadata.create_all(engine)

        def override():
            with Session(engine) as s:
                yield s

        main.app.dependency_overrides[main.get_session] = override
        return TestClient(main.app)


@SET
@given(body=hero_body)
def test_create_read_delete(clear_sqlmodel, body):
    client = Ctx().new_client()
    r = client.post("/heroes/", json=body)
    assert r.status_code == 200
    h = r.json()
    assert {k: h[k] for k in body} == body
    assert client.get(f"/heroes/{h['id']}").json() == h
    assert client.delete(f"/heroes/{h['id']}").status_code == 200
    assert client.get(f"/heroes/{h['id']}").status_code == 404
    assert client.delete(f"/heroes/{h['id']}").status_code == 404


@SET
@given(
    body=hero_body,
    name=st.none() | text,
    secret=st.none() | text,
    pa=st.none() | st.integers(-1000, 1000),
    which=st.sets(st.sampled_from(["name", "secret_name", "age"])),
)
def test_patch_only_given_fields(clear_sqlmodel, body, name, secret, pa, which):
    client = Ctx().new_client()
    vals = {"name": name, "secret_name": secret, "age": pa}
    patch = {k: vals[k] for k in which}
    h = client.post("/heroes/", json=body).json()
    r = client.patch(f"/heroes/{h['id']}", json=patch)
    assert r.status_code < 500
    assert r.status_code == 200, r.text
    exp = {**h, **patch}
    assert r.json() == exp
    assert client.get(f"/heroes/{h['id']}").json() == exp


@SET
@given(bodies=st.lists(hero_body, max_size=8), limit=st.integers(1, 100))
def test_paging(clear_sqlmodel, bodies, limit):
    client = Ctx().new_client()
    for b in bodies:
        client.post("/heroes/", json=b)
    seen = []
    off = 0
    while True:
        page = client.get("/heroes/", params={"offset": off, "limit": limit}).json()
        assert len(page) <= limit
        seen += page
        if len(page) < limit:
            break
        off += limit
    assert len(seen) == len(bodies)
    assert len({h["id"] for h in seen}) == len(seen)
