import pytest
from test_ph_props import *


@pytest.mark.parametrize("f,v", [(f, v) for f in ["username", "email", "password"] for v in [None, 5, [1]]])
def test_probe(f, v):
    ctx = fresh()
    try:
        b = {"username": "a", "email": "a@x.org", "password": "p"}
        b[f] = v
        try:
            r = client.post("/api/users", json=b)
            print(f, v, r.status_code)
        except Exception as e:
            print(f, v, "EXC", type(e).__name__, str(e)[:80])
            raise
    finally:
        ctx.pop()
