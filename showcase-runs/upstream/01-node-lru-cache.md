TITLE: load() mutates the caller's dump entries, so loading the same dump into a second cache makes every TTL entry stale
REPO: isaacs/node-lru-cache
SEARCH: load dump start
BODY:
`load()` rewrites `entry.start` on the array it is given (`src/index.ts`, in `load()`: `entry.start = this.#perf.now() - age`). After the first `load()`, `start` is no longer the portable `Date.now()`-based timestamp that `dump()` wrote but a `performance.now()`-relative one, which is tiny. A second `load()` of the same array (another cache instance, a retry, a test fixture reused between tests) computes `age = Date.now() - entry.start` as the whole epoch, so every entry with a TTL is expired on arrival.

### Repro (v11.5.3, Node 22)

```js
import { LRUCache } from 'lru-cache'

const a = new LRUCache({ max: 10, ttl: 1000 })
a.set(1, 'one')
const dump = a.dump()

const b = new LRUCache({ max: 10, ttl: 1000 })
b.load(dump)
const c = new LRUCache({ max: 10, ttl: 1000 })
c.load(dump)

console.log(b.get(1)) // 'one'
console.log(c.get(1)) // undefined  (expected 'one')
console.log(dump[0][1].start) // a large negative number: the caller's data was changed
```

The doc comment on `load()` says "The `start` fields are assumed to be calculated relative to a portable `Date.now()` timestamp", so the input is right both times; it is the first call that breaks it for the second.

### Suggested fix

Keep the conversion local instead of writing it back:

```ts
for (const [key, entry] of arr) {
  if (entry.start) {
    const age = Date.now() - entry.start
    this.#set(key, entry.value, { ...entry, start: this.#perf.now() - age })
  } else {
    this.#set(key, entry.value, entry)
  }
}
```

Found by a property-based test (`load(dump)` should give the same cache no matter how many times the dump is loaded). Happy to open a PR with the change and a test if you want it.
