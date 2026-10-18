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
