TITLE: Resource names from Object.prototype are resolved: GET /constructor returns 200, PUT /toString creates a resource
REPO: typicode/json-server
SEARCH: constructor prototype hasOwnProperty
BODY:
`Service.#get` (`src/service.ts`) returns `this.#db.data[name]` without an own-property check, so a name such as `constructor`, `toString` or `hasOwnProperty` resolves to the inherited function instead of `undefined`. The 404 handler in `src/app.ts` only fires on `undefined`, so:

```
GET /constructor      -> 200, empty body (the Object function serialised)
PUT /toString  {"a":1} -> 200, and db.data now has an own "toString" key
```

A `PUT`/`PATCH` to such a name writes into the database file, so an unknown resource can be created through a route that is meant to answer 404. Reproduced on main (1.0.0-beta.15):

```js
import { createApp } from './src/app.ts' // run from a checkout with tsx
import { Low, Memory } from 'lowdb'

const db = new Low(new Memory(), {})
db.data = { posts: [{ id: '1' }] }
const server = createApp(db).listen(0)
const base = `http://127.0.0.1:${server.address().port}`

console.log((await fetch(`${base}/constructor`)).status)  // 200, expected 404
const r = await fetch(`${base}/toString`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"a":1}' })
console.log(r.status, Object.hasOwn(db.data, 'toString'))  // 200 true, expected 404 false
server.close()
```

`Service.has()` right below `#get` already uses `Object.prototype.hasOwnProperty.call`, so the intended semantics are clear.

### Fix

```ts
#get(name: string): Item[] | Item | undefined {
  return Object.hasOwn(this.#db.data, name) ? this.#db.data[name] : undefined
}
```

Found by a property-based test (unknown resource names always give 404). Happy to open a PR with the one-line change and a test.
