<!-- proofhound-report -->
### proofhound found 1 provable bug

Checked 11 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Post ids above 2**63-1 raise OverflowError (500) in get_post instead of returning 404 <sub>(crash, flaskr/blog.py:42)</sub></summary>

| | |
|---|---|
| Function | `GET/POST /<int:id>/update, POST /<int:id>/delete` |
| Input | logged-in user, GET /9223372036854775808/update (also POST update and POST delete) |
| Expected | 404 'Post id ... doesn't exist.' as get_post documents (:raise 404: if a post with the given id doesn't exist) |
| Actual | OverflowError: Python int too large to convert to SQLite INTEGER |
| Review | low severity, confidence 0.70 |

The `<int:id>` converter accepts arbitrarily large integers, and `get_post` documents `:raise 404: if a post with the given id doesn't exist`. An id of 2**63 passes straight to sqlite3 as a bound parameter, which raises OverflowError, so the route returns a 500 instead of the documented 404. The input is valid for the route and the docstring promises the behaviour, so this is a real contract violation. It is a minor edge case in a tutorial example, so a maintainer might decline to complicate the code, for example by using `<int(max=...):id>` or catching OverflowError.

Failing test (`test_repro_huge_id.py`, failed 3/3 runs):

```python
def test_huge_id_is_404(client, auth):
    auth.login()
    big = 2**63
    assert client.get(f"/{big}/update").status_code == 404
    assert client.post(f"/{big}/update", data={"title": "x", "body": ""}).status_code == 404
    assert client.post(f"/{big}/delete").status_code == 404
```
</details>

<sub>2m35s · $0.33 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
