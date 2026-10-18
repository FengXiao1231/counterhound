# POST /api/users returns 500 when password (or username/email) is null or has a non-string type

| | |
|---|---|
| Function | `POST /users` in `app/models.py:135` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.80, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** POST /api/users {"username": "a", "email": "a@x.org", "password": null}

**Expected:** 400 Bad Request via bad_request(...), like the other validation failures in create_user

**Actual:** `AttributeError: 'NoneType' object has no attribute 'encode'`

## Reproduce

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

Fails with `AttributeError: 'NoneType' object has no attribute 'encode'`

Save it as `test_repro_create_null_password.py` in your tests and run `pytest test_repro_create_null_password.py`.

## Why this is a bug

create_user already validates input and returns 400 for missing fields and duplicates; the endpoint is the public unauthenticated sign-up, and the API convention (errors.py bad_request) is that client mistakes yield 4xx, not 500.

Independent review: create_user is an unauthenticated public sign-up endpoint that already returns 400 via bad_request for missing fields and duplicates. A JSON null password is well-formed input from the client's side, but it gets through to generate_password_hash(None) and raises AttributeError, which gives a 500. The repro failed in a fresh run with exactly this traceback. A type check next to the existing field-presence check would fix it, so a maintainer would likely accept that. This is a tutorial app, so the severity is low.

## How it was found

Property: *invalid input (wrong-typed username/email/password) gets a 4xx, never an unhandled exception*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
