import os, html
from pathlib import Path
_d = Path(__file__).resolve().parent
os.environ["DATABASE_URL"] = f"sqlite:///{_d / 'ph.db'}"
from hypothesis import given, settings, strategies as st, HealthCheck
from project.app import app, db
from project import models
app.config["TESTING"] = True

txt = st.text(alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="\x00\r"), min_size=0, max_size=15)
S = settings(max_examples=60, deadline=None, suppress_health_check=list(HealthCheck))


def fresh():
    with app.app_context():
        db.drop_all()
        db.create_all()
    return app.test_client()


def login(c):
    return c.post("/login", data=dict(username="admin", password="admin"))


@S
@given(title=txt, text=txt, q=st.text(alphabet="abcXYZ ", min_size=1, max_size=3))
def test_search_filters(title, text, q):
    c = fresh()
    login(c)
    assert c.post("/add", data=dict(title=title, text=text)).status_code == 302
    r = c.get("/search/", query_string={"query": q})
    assert r.status_code == 200
    body = r.get_data(as_text=True)
    shown = 'class="entry"' in body
    expect = q.lower() in title.lower() or q.lower() in text.lower()
    assert shown == expect


@S
@given(pid=st.integers(1, 10**6))
def test_delete_missing(pid):
    c = fresh()
    login(c)
    r = c.get(f"/delete/{pid}")
    assert r.status_code == 404 or r.get_json()["status"] == 0


@S
@given(title=txt, text=txt)
def test_create_delete(title, text):
    c = fresh()
    login(c)
    c.post("/add", data=dict(title=title, text=text))
    with app.app_context():
        ids = [p.id for p in db.session.query(models.Post)]
    assert len(ids) == 1
    assert c.get(f"/delete/{ids[0]}").get_json()["status"] == 1
    with app.app_context():
        assert db.session.query(models.Post).count() == 0


@S
@given(title=txt, text=txt)
def test_add_requires_login(title, text):
    c = fresh()
    assert c.post("/add", data=dict(title=title, text=text)).status_code == 401
    assert c.get("/delete/1").status_code == 401


@S
@given(u=txt, p=txt)
def test_login_no_crash(u, p):
    c = fresh()
    r = c.post("/login", data=dict(username=u, password=p))
    assert (r.status_code == 302) == (u == "admin" and p == "admin")


@S
@given(title=txt, text=txt)
def test_index_shows_entry(title, text):
    c = fresh()
    login(c)
    c.post("/add", data=dict(title=title, text=text))
    r = c.get("/")
    assert r.status_code == 200
    assert html.escape(title) in r.get_data(as_text=True)


def test_missing_fields():
    c = fresh()
    login(c)
    assert c.post("/add", data=dict(title="x")).status_code == 400
