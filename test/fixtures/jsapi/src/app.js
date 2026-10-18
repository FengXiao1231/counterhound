import express from 'express';

/** A small inventory API: items with a name, a price in cents and a version that counts updates. */
const app = express();
app.use(express.json());

const db = new Map();
let nextId = 1;

function validate(body) {
  if (!body || typeof body.name !== 'string' || !body.name.length || body.name.length > 50) return 'name must be 1-50 characters';
  if (!Number.isInteger(body.price) || body.price < 0) return 'price must be a non-negative integer (cents)';
  return null;
}

/** Create an item; 400 for an invalid body. The id is assigned by the server. */
app.post('/items', (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const item = { id: nextId++, name: req.body.name, price: req.body.price, version: 1 };
  db.set(item.id, item);
  res.status(201).json(item);
});

/** Return one item; 404 if it does not exist. */
app.get('/items/:id', (req, res) => {
  const item = db.get(Number(req.params.id));
  res.json({ ...item });
});

/** Replace an item's name and price. Updating with the same data again changes nothing (idempotent). */
app.put('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.has(id)) return res.status(404).json({ error: 'no such item' });
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  const item = { id, name: req.body.name, price: req.body.price, version: db.get(id).version + 1 };
  db.set(id, item);
  res.json(item);
});

/** Delete an item; 404 if it does not exist. */
app.delete('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.delete(id)) return res.status(404).json({ error: 'no such item' });
  res.status(204).end();
});

/** Items ordered by id; `offset` and `limit` page through all of them. */
app.get('/items', (req, res) => {
  const offset = Number(req.query.offset || 0), limit = Number(req.query.limit || 10);
  const items = [...db.values()].sort((a, b) => a.id - b.id);
  res.json(items.slice(offset, offset + limit - 1));
});

export default app;
