import base64
from hypothesis import given, settings, strategies as st, HealthCheck
from config import Config
from app import create_app, db


class Cfg(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ELASTICSEARCH_URL = None


app = create_app(Cfg)
app.config["TESTING"] = True
client = app.test_client()
S = settings(max_examples=40, deadline=None, suppress_health_check=list(HealthCheck))

names = st.text(st.characters(whitelist_categories=("L", "N")), min_size=1, max_size=20)
pages = st.integers(-2, 6)
pers = st.integers(-2, 120)


def fresh():
    ctx = app.app_context()
    ctx.push()
    db.drop_all()
    db.create_all()
    return ctx


def mk(i, **kw):
    b = {"username": f"u{i}", "email": f"u{i}@x.org", "password": "pw"}
    b.update(kw)
    return client.post("/api/users", json=b)


def auth_for(un, pw="pw"):
    h = {"Authorization": "Basic " + base64.b64encode(f"{un}:{pw}".encode()).decode()}
    t = client.post("/api/tokens", headers=h).get_json()["token"]
    return {"Authorization": "Bearer " + t}


def auth(i):
    return auth_for(f"u{i}")


@S
@given(n=st.integers(1, 6), page=pages, per_page=pers)
def test_paging_no_5xx(n, page, per_page):
    ctx = fresh()
    try:
        for i in range(n):
            assert mk(i).status_code == 201
        h = auth(0)
        r = client.get(f"/api/users?page={page}&per_page={per_page}", headers=h)
        assert r.status_code < 500, r.data
    finally:
        ctx.pop()


@S
@given(n=st.integers(1, 8), per_page=st.integers(1, 4))
def test_paging_covers_each_item_once(n, per_page):
    ctx = fresh()
    try:
        for i in range(n):
            mk(i)
        h = auth(0)
        seen, page = [], 1
        while page:
            r = client.get(f"/api/users?page={page}&per_page={per_page}", headers=h).get_json()
            seen += [u["id"] for u in r["items"]]
            page = page + 1 if r["_links"]["next"] else 0
        assert sorted(seen) == seen and len(set(seen)) == n
    finally:
        ctx.pop()


@S
@given(un=names, about=st.text(max_size=140), a2=st.text(max_size=140))
def test_create_get_update_idempotent(un, about, a2):
    ctx = fresh()
    try:
        r = client.post("/api/users", json={"username": un, "email": un + "@x.org", "password": "p", "about_me": about})
        assert r.status_code == 201, r.data
        body = r.get_json()
        uid = body["id"]
        h = auth_for(un, "p")
        g = client.get(f"/api/users/{uid}", headers=h)
        assert g.get_json() == body
        assert r.headers["Location"].endswith(f"/api/users/{uid}")
        for _ in range(2):
            p = client.put(f"/api/users/{uid}", json={"about_me": a2}, headers=h)
            assert p.status_code == 200
        assert p.get_json()["about_me"] == a2
        assert client.get(f"/api/users/{uid}", headers=h).get_json() == p.get_json()
        p = client.put(f"/api/users/{uid}", json={"username": un, "email": un + "@x.org"}, headers=h)
        assert p.status_code == 200
    finally:
        ctx.pop()


@S
@given(n=st.integers(2, 5))
def test_follow_lists_and_errors(n):
    ctx = fresh()
    try:
        for i in range(n):
            mk(i)
        h = auth(0)
        for path in ["followers", "following"]:
            r = client.get(f"/api/users/1/{path}", headers=h)
            assert r.status_code == 200 and r.get_json()["_meta"]["total_items"] == 0
            assert client.get(f"/api/users/999/{path}", headers=h).status_code == 404
        assert client.get("/api/users/999", headers=h).status_code == 404
        assert client.put("/api/users/2", json={}, headers=h).status_code == 403
    finally:
        ctx.pop()


@S
@given(a=names)
def test_duplicate_and_conflict(a):
    ctx = fresh()
    try:
        assert mk(1, username=a, email="a@x.org").status_code == 201
        assert mk(2, username=a, email="b@x.org").status_code == 400
        assert mk(2, username=a + "z", email="a@x.org").status_code == 400
        assert mk(2, username=a + "z", email="b@x.org").status_code == 201
        h = auth_for(a + "z")
        r = client.put("/api/users/2", json={"username": a}, headers=h)
        assert r.status_code == 400
    finally:
        ctx.pop()


@S
@given(body=st.one_of(st.lists(st.integers()), st.none(), st.integers(), st.text(),
                      st.dictionaries(st.sampled_from(["username", "email", "password"]), st.text(max_size=5))))
def test_create_invalid_body_not_5xx(body):
    ctx = fresh()
    try:
        r = client.post("/api/users", json=body)
        assert r.status_code < 500
    finally:
        ctx.pop()


@S
@given(body=st.one_of(st.lists(st.integers()), st.none(), st.integers(), st.text()))
def test_update_invalid_body_not_5xx(body):
    ctx = fresh()
    try:
        mk(0)
        r = client.put("/api/users/1", json=body, headers=auth(0))
        assert r.status_code < 500
    finally:
        ctx.pop()


@S
@given(f=st.sampled_from(["username", "email", "password"]),
       v=st.one_of(st.none(), st.integers(), st.lists(st.integers())))
def test_create_wrong_types_not_5xx(f, v):
    ctx = fresh()
    try:
        b = {"username": "a", "email": "a@x.org", "password": "p"}
        b[f] = v
        assert client.post("/api/users", json=b).status_code < 500
    finally:
        ctx.pop()
