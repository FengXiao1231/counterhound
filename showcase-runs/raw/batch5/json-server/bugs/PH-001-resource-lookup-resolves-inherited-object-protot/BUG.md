# Resource lookup resolves inherited Object.prototype keys (GET /constructor returns 200, PUT /toString creates a resource)

| | |
|---|---|
| Function | `GET /:name` in `src/app.ts` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.90, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** db.data = {posts:[{id:'1'}]}; GET /constructor; PUT /toString with {"a":1}

**Expected:** 404 Not Found for both; db.data gains no 'toString' key

**Actual:** GET /constructor returns 200 with an empty body (the Object function is serialized); PUT /toString returns 200 and writes an own 'toString' key into db.data

## Reproduce

```js
import { createApp } from '../../../../../src/app.ts';
import { Low, Memory } from 'lowdb';
import { test } from 'node:test';
import assert from 'node:assert';

test('repro_prototype_names', async () => {
  const db = new Low(new Memory(), {});
  db.data = { posts: [{ id: '1' }] };
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const g = await fetch(`${base}/constructor`);
    assert.equal(g.status, 404, 'GET /constructor (no such resource) should be 404');
    const p = await fetch(`${base}/toString`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    assert.equal(p.status, 404, 'PUT /toString (no such resource) should be 404');
    assert.equal(Object.prototype.hasOwnProperty.call(db.data, 'toString'), false);
  } finally {
    server.close();
  }
});
```

Fails with `AssertionError: GET /constructor (no such resource) should be 404`

Run it with `node --test repro_prototype_names.test.mjs` (fix the import path if you move it).

## Why this is a bug

Service.#get does this.#db.data[name] without an own-property check, although Service.has() exists and uses hasOwnProperty; the final handler returns 404 whenever the lookup yields undefined, which shows unknown names are meant to be 404.

Independent review: `Service.#get` (src/service.ts:88) returns `this.#db.data[name]` with no own-property check, so a name like `constructor` or `toString` yields an inherited function instead of `undefined`. The 404 handler in app.ts only triggers when the lookup is `undefined`, so GET returns 200 with a serialized function. `#updateOrPatch` then runs `this.#db.data[name] = body`, which writes an own key into the db for a resource that never existed. The repro is valid, and `Service.has()` already shows the intended own-property semantics. The fix is a one-line `hasOwnProperty` guard in `#get`, which a maintainer would likely accept, though the impact is small for a local mock server.

## How it was found

Property: *unknown resource names give 404, never a 200 or a mutation*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
