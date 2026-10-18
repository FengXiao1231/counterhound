import os
import tempfile

from hypothesis import given, settings, strategies as st

from flaskr import create_app
from flaskr.db import init_db, get_db


def make_client():
    fd, path = tempfile.mkstemp()
    os.close(fd)
    app = create_app({"TESTING": True, "DATABASE": path})
    with app.app_context():
        init_db()
    c = app.test_client()
    c.post("/auth/register", data={"username": "u", "password": "p"})
    c.post("/auth/login", data={"username": "u", "password": "p"})
    return c, app


text = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="\x00\r"),
    max_size=30,
)
title = text.filter(lambda s: s != "")


@settings(max_examples=40, deadline=None)
@given(t=title, b=text, t2=title, b2=text)
def test_create_update_delete(t, b, t2, b2):
    c, app = make_client()
    assert c.post("/create", data={"title": t, "body": b}).status_code == 302
    with app.app_context():
        row = get_db().execute("select id,title,body from post").fetchone()
    assert (row["title"], row["body"]) == (t, b)
    i = row["id"]
    assert c.post(f"/{i}/update", data={"title": t2, "body": b2}).status_code == 302
    assert c.get(f"/{i}/update").status_code == 200
    assert c.post(f"/{i}/delete").status_code == 302
    assert c.get(f"/{i}/update").status_code == 404
    assert c.post(f"/{i}/delete").status_code == 404


@settings(max_examples=60, deadline=None)
@given(i=st.integers(min_value=0, max_value=10**30))
def test_unknown_ids_404(i):
    c, _ = make_client()
    assert c.get(f"/{i}/update").status_code == 404
    assert c.post(f"/{i}/update", data={"title": "x", "body": ""}).status_code == 404
    assert c.post(f"/{i}/delete").status_code == 404
