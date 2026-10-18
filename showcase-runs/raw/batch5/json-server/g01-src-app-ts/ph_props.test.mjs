import { createApp } from '../../../../src/app.ts';
import { Low, Memory } from 'lowdb';
import { test } from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';

async function withApp(data, fn) {
  const db = new Low(new Memory(), data);
  db.data = data;
  const server = createApp(db).listen(0);
  await new Promise((r) => setTimeout(r, 5));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn(base, db); } finally { server.close(); }
}
const j = (base, method, path, body) =>
  fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

const key = fc.stringMatching(/^[a-z]{1,6}$/);
const val = fc.oneof(fc.integer(), fc.string({ maxLength: 8 }), fc.boolean());
const obj = fc.dictionary(key.filter((k) => k !== 'id'), val, { maxKeys: 4 });

test('create/read/put/patch/delete lifecycle', async () => {
  await fc.assert(fc.asyncProperty(obj, obj, obj, async (a, b, c) => {
    await withApp({ posts: [] }, async (base) => {
      let r = await j(base, 'POST', '/posts', a);
      assert.equal(r.status, 201);
      const created = await r.json();
      r = await fetch(`${base}/posts/${created.id}`);
      assert.deepEqual(await r.json(), created);
      for (let i = 0; i < 2; i++) {
        r = await j(base, 'PUT', `/posts/${created.id}`, b);
        assert.equal(r.status, 200);
        assert.deepEqual(await r.json(), { ...b, id: created.id });
      }
      r = await j(base, 'PATCH', `/posts/${created.id}`, c);
      assert.deepEqual(await r.json(), { ...b, ...c, id: created.id });
      r = await fetch(`${base}/posts/${created.id}`, { method: 'DELETE' });
      assert.equal(r.status, 200);
      assert.equal((await fetch(`${base}/posts/${created.id}`)).status, 404);
      assert.equal((await fetch(`${base}/posts/${created.id}`, { method: 'DELETE' })).status, 404);
    });
  }), { numRuns: 25 });
});

test('paging returns each item once', async () => {
  await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 15 }), fc.integer({ min: 1, max: 6 }), async (n, pp) => {
    const posts = Array.from({ length: n }, (_, i) => ({ id: String(i), n: i }));
    await withApp({ posts }, async (base) => {
      const seen = [];
      let page = 1;
      for (;;) {
        const p = await (await fetch(`${base}/posts?_page=${page}&_per_page=${pp}`)).json();
        seen.push(...p.data.map((x) => x.id));
        if (p.next === null) break;
        page = p.next;
      }
      assert.deepEqual(seen, posts.map((x) => x.id));
    });
  }), { numRuns: 25 });
});

test('unknown / odd names never 5xx', async () => {
  const names = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];
  for (const name of names) {
    await withApp({ posts: [] }, async (base) => {
      for (const [m, p, b] of [['GET', `/${name}`], ['GET', `/${name}/1`], ['POST', `/${name}`, {}], ['PUT', `/${name}`, { a: 1 }], ['PATCH', `/${name}`, { a: 1 }], ['PUT', `/${name}/1`, {}], ['PATCH', `/${name}/1`, {}], ['DELETE', `/${name}/1`]]) {
        const r = await j(base, m, p, b);
        assert.ok(r.status < 500, `${m} ${p} -> ${r.status}`);
      }
    });
  }
});

test('delete with _dependent only removes children of the deleted parent', async () => {
  await withApp({ posts: [{ id: '1' }], comments: [{ id: 'c1', postId: '1' }, { id: 'c2', postId: '2' }, { id: 'c3' }] }, async (base) => {
    await fetch(`${base}/posts/1?_dependent=comments`, { method: 'DELETE' });
    const left = (await (await fetch(`${base}/comments`)).json()).map((c) => c.id);
    assert.deepEqual(left, ['c2', 'c3']);
  });
});
