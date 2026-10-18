# Manually verified
- humanize: ordinal(-1) == '-1th' (also -2 -> '-2th', -3 -> '-3th'). Low severity. Verified by hand.
- inflection: camelize('', uppercase_first_letter=False) raises IndexError while camelize('') returns ''. Verified by hand. (repo last commit 2023)
- parse: parse('{:%Y-%m-%d %H:%M:%S%z}|{}', '2020-03-04 05:06:07+0200|abc') gives second field '00' instead of 'abc' (%z capture groups not counted). Strong. Verified by hand.
- rfc3986: ParseResultBytes.from_string(b'/a').unsplit() -> AttributeError 'NoneType' has no 'encode'. Verified.
- rfc3986: URIBuilder(query='a=').extend_query_with([('b','c')]).query == 'b=c' (drops 'a='). Verified.
- rfc3986: normalize_uri('a:/.//b') == 'a://b' (path turns into authority; RFC 3986 5.2.4 says to guard this). Verified.
- rfc3986: normalize_uri('file:///etc/hosts') == 'file:/etc/hosts'. Verified behaviour; debatable whether a bug (equivalent per some readings). Keep as "debatable".
- toolz: memoize(f)(a=0) for unary f raises IndexError. Verified.
- inflect: plural_noun('Son Of A Gun') raises IndexError (lowercase works). Verified.
- ini: stringify({a:"'"}) -> "a='" which parses back as a: "". Verified.
- ini: stringify({a:'\;'}) parses back as ';' (escape not round-tripped). Verified.
- punycode.js: toASCII('a@b@c') and toUnicode('a@b@c') return 'a@b' (silently drops the rest). Verified; input is not a valid email, so medium/debatable.
- qs: stringify(obj, {filter: arr, sort}) sorts the caller's filter array in place. Verified.
- qs: parse('a=b,c', {comma:true, charset:'iso-8859-1', interpretNumericEntities:true}) returns {a:'b,c'} instead of ['b','c']. Verified.
- filesize: internal helper getBaseConfiguration('constructor') returns Object constructor as isDecimal. Verified but internal helper; weak, exclude from showcase.

## Batch 3: 41 libraries, five languages, with --fix (2026-10-17)

26 confirmed. Hand check against the source: 19 clear, 7 debatable (change-case astral letters, cron-parser empty seed,
humansize "-1 Bytes", gobwas/glob Lexer.Offset, levenshtein InsCost(0) NaN, uritemplate partial with '', byte-unit 1e-29), 0 wrong.
Re-ran by hand: levenshtein Calculate("aaa","bbbab",2,1,2,2) = 2 vs 6 unlimited; uritemplate expand('{+x}', {'x': 'a b%41'}) = 'a b%41';
num2words bn 0.01 currency = "দশ পয়সা", 1.05 == 1.5 reading.
17 patches written, 17 verified (repro passes; project suite passed for 12, already failing for 3, none for 2), all apply with git apply --check.
The raw run's patches also contained a hunk for the run's own log file (ph-err.txt); counterhound now diffs against a snapshot, and the
copies here have those hunks removed. 9 bugs got no patch because the per-library --budget 0.5 was used up (now --fix-budget).

## Batch 4: 12 stateful libraries, model-based tests (2026-10-18)

6 confirmed, 6 real on hand check (ran each repro by hand and read the source line): ordered-set pop() (`del self.map[elem]` with no
renumbering, discard() renumbers), ordered-set symmetric_difference_update (`items_to_add` list not de-duplicated), transitions core.py:1141/1143
(`hasattr(source, 'name')` on the whole argument), denque removeOne/remove (branch tests use `index`, not the normalised `i`),
lru-cache src/index.ts:2124 (`entry.start = this.#perf.now() - age` on the caller's object). 0 wrong, 0 debatable.
lru-cache first produced no targets: the scanner stopped at the `{}` inside `class LRUCache<K extends {}, …>` and did not see state changes made
through private `#methods`; both fixed, then re-run alone (--max-modules 1 --budget 0.7). Total about $3.30 for the batch.

## Batch 5: 5 HTTP APIs with --api (2026-10-18)

5 confirmed, 5 real on hand check (ran each repro by hand in the project, read the handler): flaskr blog.py:42 (`(id,)` bound into sqlite3,
OverflowError for 2**63), microblog app/api/users.py:47 and :71 (`'username' in data` on a non-dict body; `set_password(None)` in models.py:135),
sqlmodel tutorial001_py310/main.py:82-91 (`HeroUpdate.name: str | None`, NOT NULL at commit), json-server src/service.ts:88-89 (`this.#db.data[name]`
with no hasOwnProperty, while `has()` on line 92 does it right; app.ts:161 only 404s on `undefined`). 0 wrong, 0 debatable.
1 rejected by the reviewer (flaskr-tdd `/delete/<id>` returning status 1 for a missing post): checked tests/app_test.py:80-88, the project's
own test expects exactly that, so the rejection is right. All 5 are low severity and 4 of the 5 apps are tutorials. Total about $1.90.
The json-server app is tinyhttp (`new App()`), detected as Express; the loopback-server client worked unchanged.
