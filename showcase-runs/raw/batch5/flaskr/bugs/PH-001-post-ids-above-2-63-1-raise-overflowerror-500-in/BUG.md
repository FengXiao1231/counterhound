# Post ids above 2**63-1 raise OverflowError (500) in get_post instead of returning 404

| | |
|---|---|
| Function | `GET/POST /<int:id>/update, POST /<int:id>/delete` in `flaskr/blog.py:42` |
| Kind | Crash on valid input |
| Review | confirmed, confidence 0.70, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** logged-in user, GET /9223372036854775808/update (also POST update and POST delete)

**Expected:** 404 'Post id ... doesn't exist.' as get_post documents (:raise 404: if a post with the given id doesn't exist)

**Actual:** `OverflowError: Python int too large to convert to SQLite INTEGER`

## Reproduce

```python
def test_huge_id_is_404(client, auth):
    auth.login()
    big = 2**63
    assert client.get(f"/{big}/update").status_code == 404
    assert client.post(f"/{big}/update", data={"title": "x", "body": ""}).status_code == 404
    assert client.post(f"/{big}/delete").status_code == 404
```

Fails with `OverflowError: Python int too large to convert to SQLite INTEGER`

Save it as `test_repro_huge_id.py` in your tests and run `pytest test_repro_huge_id.py`.

## Why this is a bug

get_post docstring: ':raise 404: if a post with the given id doesn't exist'; <int:id> accepts arbitrarily large integers, so any non-existent id should be 404.

Independent review: The `<int:id>` converter accepts arbitrarily large integers, and `get_post` documents `:raise 404: if a post with the given id doesn't exist`. An id of 2**63 passes straight to sqlite3 as a bound parameter, which raises OverflowError, so the route returns a 500 instead of the documented 404. The input is valid for the route and the docstring promises the behaviour, so this is a real contract violation. It is a minor edge case in a tutorial example, so a maintainer might decline to complicate the code, for example by using `<int(max=...):id>` or catching OverflowError.

## How it was found

Property: *unknown ids give 404, never a crash*.

Hypothesis shrank the failure to: `Failing test case: test_unknown_ids_404( i=9_223_372_036_854_775_808, )`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
