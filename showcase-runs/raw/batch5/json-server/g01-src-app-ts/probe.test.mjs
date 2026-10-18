import { createApp } from '../../../../src/app.ts';
import { Low, Memory } from 'lowdb';
import { test } from 'node:test';

test('probe', async () => {
  const db = new Low(new Memory(), {});
  db.data = { posts: [{ id: '1', t: 'a' }], profile: { name: 'x' } };
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = [];
  const h ={ 'content-type': 'application/json' };
  const show = async (m, p, b) => {
    const r = await fetch(base + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
    out.push([m, p, r.status, (await r.text()).slice(0, 100)].join(' '));
  };
  await show('GET', '/constructor');
  await show('GET', '/constructor/1');
  await show('PUT', '/constructor', { a: 1 });
  await show('GET', '/constructor');
  await show('PUT', '/toString', { a: 1 });
  await show('GET', '/toString');
  await show('PUT', '/__proto__', { zzz: 1 });
  await show('GET', '/zzz');
  await show('GET', '/posts/1?_embed=constructor');
  await show('GET', '/posts?_embed=constructor');
  await show('GET', '/posts?_sort=__proto__');
  await show('PATCH', '/profile', { a: 1 });
  await show('POST', '/profile', { a: 1 });
  await show('GET', '/posts?_page=1&_per_page=0');
  await show('GET', '/posts?_page=-3');
  server.close();
  throw new Error(out.join('\n'));
});
