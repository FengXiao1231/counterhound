# punycode.toASCII/toUnicode truncate input containing more than one '@'

| | |
|---|---|
| Function | `punycode.toASCII` in `punycode.js` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.70, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** toASCII('a@b@c')

**Expected:** 'a@b@c' (already ASCII, so unchanged; only the domain part is punycoded)

**Actual:** 'a@b' (the '@c' suffix is silently discarded; toUnicode has the same behaviour)

## Reproduce

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../../../../../punycode.js';

test('repro_multi_at', () => {
  assert.equal(mod.toASCII('a@b@c'), 'a@b@c');
});
```

Fails with `AssertionError: Expected values to be strictly equal:`

## Why this is a bug

Docs say 'Only the non-ASCII parts of the domain name will be converted, i.e. it doesn't matter if you call it with a domain that's already in ASCII', and mapDomain says 'Leave the local part (i.e. everything up to `@`) intact'. mapDomain uses domain.split('@') and only keeps parts[0] and parts[1], so parts[2..] are lost. Quoted local parts may legally contain '@' (RFC 5321), so this is data loss rather than a rejected input.

Independent review: mapDomain does `domain.split('@')` and uses only parts[0] and parts[1], so any further segments are silently dropped. `toASCII('a@b@c')` returns `'a@b'`, losing characters from an already-ASCII input, which contradicts the docs saying already-ASCII input is fine. A valid RFC 5321 address with a quoted local part, such as `"a@b"@例え.jp`, is also mangled: the real domain is lost and never punycoded. Splitting on the last '@' (`lastIndexOf`) is a small, safe fix. The case is rare and the library is in maintenance mode, so a maintainer might treat it as low priority.

## How it was found

Property: *converting an address/domain must not lose characters: an ASCII-only input is returned unchanged*.

fast-check shrank the failure to: `Counterexample: [["a","a","a"]]`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
