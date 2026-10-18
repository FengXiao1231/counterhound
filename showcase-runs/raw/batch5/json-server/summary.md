<!-- proofhound-report -->
### proofhound found 1 provable bug

Checked 8 functions in 1 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Resource lookup resolves inherited Object.prototype keys (GET /constructor returns 200, PUT /toString creates a resource) <sub>(wrong result, src/app.ts)</sub></summary>

| | |
|---|---|
| Function | `GET /:name` |
| Input | db.data = {posts:[{id:'1'}]}; GET /constructor; PUT /toString with {"a":1} |
| Expected | 404 Not Found for both; db.data gains no 'toString' key |
| Actual | GET /constructor returns 200 with an empty body (the Object function is serialized); PUT /toString returns 200 and writes an own 'toString' key into db.data |
| Review | low severity, confidence 0.90 |

`Service.#get` (src/service.ts:88) returns `this.#db.data[name]` with no own-property check, so a name like `constructor` or `toString` yields an inherited function instead of `undefined`. The 404 handler in app.ts only triggers when the lookup is `undefined`, so GET returns 200 with a serialized function. `#updateOrPatch` then runs `this.#db.data[name] = body`, which writes an own key into the db for a resource that never existed. The repro is valid, and `Service.has()` already shows the intended own-property semantics. The fix is a one-line `hasOwnProperty` guard in `#get`, which a maintaine

Failing test (`repro_prototype_names.test.mjs`, failed 3/3 runs):

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
</details>

<sub>1m30s · $0.35 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
