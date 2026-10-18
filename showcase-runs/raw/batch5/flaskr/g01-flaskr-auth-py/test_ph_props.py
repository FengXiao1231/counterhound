import os, tempfile
from hypothesis import given, settings, strategies as st
from flaskr import create_app
from flaskr.db import init_db

def mk():
    fd, p = tempfile.mkstemp(); os.close(fd)
    app = create_app({"TESTING": True, "DATABASE": p})
    with app.app_context():
        init_db()
    return app, p

txt = st.text(min_size=1, max_size=20)

@settings(max_examples=60, deadline=None)
@given(u=txt, p=txt)
def test_register_login_roundtrip(u, p):
    app, path = mk()
    try:
        c = app.test_client()
        r = c.post("/auth/register", data={"username": u, "password": p})
        assert r.status_code == 302 and r.headers["Location"].endswith("/auth/login")
        r = c.post("/auth/login", data={"username": u, "password": p})
        assert r.status_code == 302
        with c.session_transaction() as s:
            assert "user_id" in s
        r = c.post("/auth/register", data={"username": u, "password": p})
        assert r.status_code == 200 and b"already registered" in r.data
        c.get("/auth/logout")
        with c.session_transaction() as s:
            assert "user_id" not in s
    finally:
        os.unlink(path)

@settings(max_examples=60, deadline=None)
@given(u=txt, p=txt, q=txt)
def test_wrong_password_rejected(u, p, q):
    app, path = mk()
    try:
        c = app.test_client()
        c.post("/auth/register", data={"username": u, "password": p})
        r = c.post("/auth/login", data={"username": u, "password": q})
        if p != q:
            assert r.status_code == 200
            with c.session_transaction() as s:
                assert "user_id" not in s
    finally:
        os.unlink(path)

@settings(max_examples=40, deadline=None)
@given(u=st.text(max_size=5), p=st.text(max_size=5))
def test_login_unknown_no_5xx(u, p):
    app, path = mk()
    try:
        c = app.test_client()
        r = c.post("/auth/login", data={"username": u, "password": p})
        assert r.status_code < 500
        r = c.post("/auth/register", data={"username": u, "password": p})
        assert r.status_code < 500
    finally:
        os.unlink(path)
