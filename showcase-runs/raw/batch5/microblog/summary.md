<!-- counterhound-report -->
### counterhound found 2 provable bugs

Checked 8 functions in 2 modules with property-based tests. 2 reported → 2 reproduced → 2 unique → 2 confirmed by an independent review.

<details><summary><b>PH-001</b> POST /api/users returns 500 when password (or username/email) is null or has a non-string type <sub>(crash, app/models.py:135)</sub></summary>

| | |
|---|---|
| Function | `POST /users` |
| Input | POST /api/users {"username": "a", "email": "a@x.org", "password": null} |
| Expected | 400 Bad Request via bad_request(...), like the other validation failures in create_user |
| Actual | AttributeError: 'NoneType' object has no attribute 'encode' |
| Review | low severity, confidence 0.80 |

create_user is an unauthenticated public sign-up endpoint that already returns 400 via bad_request for missing fields and duplicates. A JSON null password is well-formed input from the client's side, but it gets through to generate_password_hash(None) and raises AttributeError, which gives a 500. The repro failed in a fresh run with exactly this traceback. A type check next to the existing field-presence check would fix it, so a maintainer would likely accept that. This is a tutorial app, so the severity is low.

Failing test (`test_repro_create_null_password.py`, failed 3/3 runs):

```python
from config import Config
from app import create_app, db


class Cfg(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ELASTICSEARCH_URL = None


def test_create_user_null_password_is_4xx_not_crash():
    app = create_app(Cfg)
    app.config["TESTING"] = True
    with app.app_context():
        db.create_all()
        r = app.test_client().post("/api/users", json={
            "username": "a", "email": "a@x.org", "password": None})
        assert 400 <= r.status_code < 500
```
</details>

<details><summary><b>PH-002</b> POST /users and PUT /users/<id> return 500 when the JSON body is not an object <sub>(crash, app/api/users.py:71)</sub></summary>

| | |
|---|---|
| Function | `PUT /users/{id}` |
| Input | authenticated PUT /api/users/1 with JSON body 0 (also null) |
| Expected | 400 Bad Request |
| Actual | TypeError: argument of type 'int' is not iterable |
| Review | low severity, confidence 0.72 |

Both handlers (app/api/users.py:47-48 and 70-71) call request.get_json() and then run `'username' in data` without checking that data is a dict. A valid JSON body such as 0, null or a list raises TypeError, which becomes an unhandled 500. The API already answers bad input with bad_request() (400), and the repro uses the API correctly with a valid token and a valid JSON body. The impact is small: it is a tutorial-style app, only an authenticated user can hit the PUT crash, and it leaks no data. A one-line `isinstance(data, dict)` guard returning 400 would be an easy fix for a maintainer to acce

Failing test (`test_repro_update_non_object_body.py`, failed 3/3 runs):

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
</details>

<sub>5m02s · $0.55 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
