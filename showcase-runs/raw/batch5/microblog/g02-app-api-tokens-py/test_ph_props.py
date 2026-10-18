import base64
from hypothesis import given, settings, strategies as st
from app import create_app, db
from app.models import User
from config import Config


class Cfg(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ELASTICSEARCH_URL = None


app = create_app(Cfg)
app.config["TESTING"] = True
client = app.test_client()
ctx = app.app_context()
ctx.push()
db.create_all()

names = st.text(st.characters(blacklist_characters=":", blacklist_categories=("Cs", "Cc")), min_size=1, max_size=20)
pws = st.text(st.characters(blacklist_categories=("Cs", "Cc")), min_size=1, max_size=20)
counter = [0]


def basic(u, p):
    return {"Authorization": "Basic " + base64.b64encode(f"{u}:{p}".encode()).decode()}


def bearer(t):
    return {"Authorization": "Bearer " + t}


def mk(name, pw):
    counter[0] += 1
    u = User(username=f"{name}{counter[0]}", email=f"u{counter[0]}@x.com")
    u.set_password(pw)
    db.session.add(u)
    db.session.commit()
    return u.username


@settings(max_examples=40, deadline=None)
@given(names, pws)
def test_token_lifecycle(n, pw):
    u = mk(n, pw)
    r = client.post("/api/tokens", headers=basic(u, pw))
    assert r.status_code == 200
    t = r.get_json()["token"]
    assert len(t) == 32
    assert client.post("/api/tokens", headers=basic(u, pw)).get_json()["token"] == t
    assert client.get("/api/users/1", headers=bearer(t)).status_code in (200, 404)
    r = client.delete("/api/tokens", headers=bearer(t))
    assert r.status_code == 204
    assert client.delete("/api/tokens", headers=bearer(t)).status_code == 401
    assert client.get("/api/users/1", headers=bearer(t)).status_code == 401
    t2 = client.post("/api/tokens", headers=basic(u, pw)).get_json()["token"]
    assert t2 != t
    assert client.delete("/api/tokens", headers=bearer(t2)).status_code == 204


@settings(max_examples=40, deadline=None)
@given(names, pws, pws)
def test_bad_creds(n, pw, other):
    u = mk(n, pw)
    if other != pw:
        assert client.post("/api/tokens", headers=basic(u, other)).status_code == 401
    assert client.post("/api/tokens", headers=basic(u + "zz", pw)).status_code == 401
    assert client.post("/api/tokens").status_code == 401
    assert client.delete("/api/tokens").status_code == 401
    assert client.delete("/api/tokens", headers=bearer(other)).status_code == 401
