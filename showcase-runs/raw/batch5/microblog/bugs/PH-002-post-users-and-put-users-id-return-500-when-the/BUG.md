# POST /users and PUT /users/<id> return 500 when the JSON body is not an object

| | |
|---|---|
| Function | `PUT /users/{id}` in `app/api/users.py:71` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.72, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** authenticated PUT /api/users/1 with JSON body 0 (also null)

**Expected:** 400 Bad Request

**Actual:** `TypeError: argument of type 'int' is not iterable`

## Reproduce

```python
import base64
from config import Config
from app import create_app, db


class Cfg(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ELASTICSEARCH_URL = None


def test_update_user_non_object_json_body_is_4xx_not_crash():
    app = create_app(Cfg)
    app.config["TESTING"] = True
    c = app.test_client()
    with app.app_context():
        db.create_all()
        assert c.post("/api/users", json={
            "username": "a", "email": "a@x.org", "password": "p"}).status_code == 201
        basic = {"Authorization": "Basic " + base64.b64encode(b"a:p").decode()}
        tok = c.post("/api/tokens", headers=basic).get_json()["token"]
        r = c.put("/api/users/1", json=0, headers={"Authorization": "Bearer " + tok})
        assert 400 <= r.status_code < 500
```

Fails with `TypeError: argument of type 'int' is not iterable`

Save it as `test_repro_update_non_object_body.py` in your tests and run `pytest test_repro_update_non_object_body.py`.

## Why this is a bug

Handler does `'username' in data` assuming a dict without checking; API returns JSON 4xx errors for bad requests via bad_request().

Independent review: Both handlers (app/api/users.py:47-48 and 70-71) call request.get_json() and then run `'username' in data` without checking that data is a dict. A valid JSON body such as 0, null or a list raises TypeError, which becomes an unhandled 500. The API already answers bad input with bad_request() (400), and the repro uses the API correctly with a valid token and a valid JSON body. The impact is small: it is a tutorial-style app, only an authenticated user can hit the PUT crash, and it leaks no data. A one-line `isinstance(data, dict)` guard returning 400 would be an easy fix for a maintainer to accept.

## How it was found

Property: *a malformed request body gets a 4xx, never an unhandled exception*.

Hypothesis shrank the failure to: `Failing test case: test_update_invalid_body_not_5xx( body=0, )`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
