# Bugs found by counterhound

Real bugs counterhound found in popular open-source libraries. Every entry was reproduced by
counterhound (the repro failed 3/3 in fresh processes), confirmed by its independent reviewer,
and then **re-run by hand** against the library's latest `main` on 2026-10-17.
Eleven of them are reported upstream; the list is at the [end of this file](#reported-upstream).

Run: 25 libraries, 46 modules, 204 functions, Claude Sonnet, about 32 minutes of machine time and $9 in total.
(23 reported → 21 reproduced → 20 confirmed; 1 rejected by review, 2 dropped as broken tests).
The raw data of every run (`results.json`, the hunter's tests and repros, the reviewer's verdicts and reports) is in `showcase-runs/raw/<batch>/<library>/`, for all five batches including this one: `early` and `batch1` (together this table), `batch2` (Go and Rust), `batch3` (five languages with `--fix`; the patches there had a log-file hunk removed by hand, see `manual-verification.md`), `batch4` (stateful classes) and `self`.
Hand-checking the 20 confirmed findings: 17 are clear bugs, 3 are debatable (listed separately below), none were wrong.

| Library | Bug | Repro |
|---|---|---|
| [parse](https://github.com/r1chardj0n3s/parse) | A `%z` datetime field shifts every later positional field, because its capture groups are not counted | `parse("{:%Y-%m-%d %H:%M:%S%z}\|{}", "2020-03-04 05:06:07+0200\|abc")[1]` is `'00'`, not `'abc'` |
| [toolz](https://github.com/pytoolz/toolz) | `memoize` of a one-argument function crashes when the argument is passed by keyword | `memoize(lambda a: a)(a=0)` → `IndexError` |
| [qs](https://github.com/ljharb/qs) | `stringify` sorts the caller's `filter` array in place | `stringify(o, { filter: ['i','a'], sort })` leaves `filter` as `['a','i']` |
| [qs](https://github.com/ljharb/qs) | `comma: true` stops producing arrays with `charset: 'iso-8859-1'` + `interpretNumericEntities` | `parse('a=b,c', {...})` → `{ a: 'b,c' }` |
| [inflect](https://github.com/jaraco/inflect) | Title-cased compound nouns crash | `plural_noun("Son Of A Gun")` → `IndexError` (lower case works) |
| [rfc3986](https://github.com/python-hyper/rfc3986) | `ParseResultBytes.unsplit()` crashes for URIs without an authority | `ParseResultBytes.from_string(b"/a").unsplit()` → `AttributeError` |
| [rfc3986](https://github.com/python-hyper/rfc3986) | `URIBuilder.extend_query_with` drops existing blank-valued parameters | `URIBuilder(query="a=").extend_query_with([("b","c")]).query == "b=c"` |
| [rfc3986](https://github.com/python-hyper/rfc3986) | Normalizing can turn a path into an authority (RFC 3986 §5.2.4 warns about this) | `normalize_uri("a:/.//b") == "a://b"` |
| [ini](https://github.com/npm/ini) | A value that is a single `'` does not survive stringify → parse | `parse(stringify({a: "'"}))` → `{ a: '' }` |
| [ini](https://github.com/npm/ini) | A backslash before `;` is lost in a round trip | `parse(stringify({a: '\;'}))` → `{ a: ';' }` |
| [boltons](https://github.com/mahmoud/boltons) | `TracebackInfo.from_dict` is documented as the complement of `to_dict` but never rebuilds `Callpoint`s | `TracebackInfo.from_dict(ti.to_dict()).to_dict()` → `AttributeError` |
| [boltons](https://github.com/mahmoud/boltons) | Histogram of an empty `Stats` divides by zero | `Stats([]).format_histogram()` → `ZeroDivisionError` |
| [boltons](https://github.com/mahmoud/boltons) | `QueryParamDict` does not round-trip a `;` in a value, even with `full_quote=True` | `to_text()` gives `a=b;c`, which parses back as `[('a','b'), ('c', None)]` |
| [boltons](https://github.com/mahmoud/boltons) | `relative_time(..., ndigits=6)` prints only 6 significant digits | 1.123456 s → `'1.12346 seconds ago'` |
| [ms](https://github.com/vercel/ms) | Negative half values round toward zero and get the wrong plural | `format(-1500, { long: true })` → `'-1 seconds'` (`1500` gives `'2 seconds'`) |
| [humanize](https://github.com/python-humanize/humanize) | Negative ordinals get the wrong suffix | `ordinal(-1)` → `'-1th'` |
| [inflection](https://github.com/jpvanhal/inflection) | `camelize` crashes on an empty string with `uppercase_first_letter=False` | `camelize('', False)` → `IndexError` (`camelize('')` returns `''`) |

Debatable (reproduced, but arguably out of contract):

- [punycode.js](https://github.com/bestiejs/punycode.js): `toASCII('a@b@c')` silently returns `'a@b'`. Not a valid email, but data is dropped without an error.
- [rfc3986](https://github.com/python-hyper/rfc3986): `normalize_uri('file:///etc/hosts')` returns `'file:/etc/hosts'`.
- [filesize](https://github.com/avoidwork/filesize.js): internal helper `getBaseConfiguration('constructor')` picks up `Object.prototype.constructor`.

No bugs reported in: python-slugify, dateutil (parser, relativedelta, easter, rrule), python-semver (one finding refuted by the reviewer), packaging, sqlparse, markupsafe, semver, cookie, content-type, pretty-ms, camelcase, he, bytes.

## Go and Rust

Run: 15 libraries (8 Go, 7 Rust), 26 modules, 111 functions, Claude Sonnet, about $5.10 in total
(11 reported → 11 reproduced → 7 confirmed; 3 rejected by review, 1 the reviewer was unsure about).
The unsure one, `humantime::parse_duration("1 30m")` returning 130 minutes, was first dropped as a broken test: an
`assert!` with a custom message was misread as a panic in the test. That is fixed and covered by a test.
Hand-checking the 7 confirmed findings against the source: 6 are clear bugs, 1 is debatable, none were wrong.

| Library | Bug | Repro |
|---|---|---|
| [gosimple/slug](https://github.com/gosimple/slug) (Go) | With `EnableSmartTruncate = false` and the default `MaxLength = 0` (no limit), every slug comes back empty | `slug.EnableSmartTruncate = false; slug.Make("a")` → `""` |
| [gosimple/slug](https://github.com/gosimple/slug) (Go) | Truncation can leave a trailing `_`, so the result fails `IsSlug`, which is documented to accept all output of `Make` | `slug.MaxLength = 2; slug.Make("0_0")` → `"0_"` |
| [hashicorp/go-version](https://github.com/hashicorp/go-version) (Go) | `Compare` ignores the prerelease when the segment counts differ, so equality is not transitive | `1.0.0.0-alpha` compares equal to `1.0.0`, while `1.0.0-alpha` < `1.0.0` |
| [iancoleman/strcase](https://github.com/iancoleman/strcase) (Go) | `ToLowerCamel` returns an upper-case first letter when the input starts with `_`, `-` or `.` | `ToLowerCamel("_some_string")` → `"SomeString"` |
| [mitchellh/go-wordwrap](https://github.com/mitchellh/go-wordwrap) (Go) | With a limit of 1, single-character words are never wrapped | `WrapString("a b", 1)` → `"a b"` (expected `"a\nb"`) |
| [humantime](https://github.com/chronotope/humantime) (Rust) | The strict RFC 3339 parser accepts trailing garbage after `Z` | `parse_rfc3339("1970-01-01T00:00:00ZZ")` → `Ok(UNIX_EPOCH)` |

Debatable:

- [convert_case](https://github.com/rutrum/convert-case) (Rust): a space followed by a combining mark (`" \u{301}"`, one grapheme) is split by the byte-level fast path but not by the grapheme path, so adding a boundary that cannot match changes the output.

No bugs reported in: go-humanize, xstrings, Masterminds/semver, c2h5oh/datasize, bytesize, inflector, slug (Rust), textwrap, heck (two findings refuted by the reviewer).


## Five languages, with `--fix`

Run: 41 libraries (10 Python, 9 JS, 7 Go, 7 Rust, 8 Java), 69 modules, 309 functions, Claude Sonnet, `--max-modules 2 --budget 0.5 --fix`,
about 55 minutes of machine time and $14.75 in total (33 reported → 33 reproduced → 26 confirmed; 5 rejected by review, 2 the reviewer was unsure about).
Hand-checking the 26 confirmed findings against the source: 19 are clear bugs, 7 are debatable, none were wrong.

`--fix` wrote a patch for 17 of them; the other 9 were not attempted because the run's `--budget` was already used up
(fixes now get their own `--fix-budget`). **All 17 patches were verified**: the repro passes with the patch, and the project's own test suite still passes for 12 of them
(for 3 the suite already failed without the patch, 2 projects have no test command). Every patch applies cleanly with `git apply`.
A ✓ in the patch column means a verified patch exists.

| Library | Bug | Repro | Patch |
|---|---|---|---|
| [spf13/cast](https://github.com/spf13/cast) (Go) | `ToStringMapIntE` panics instead of returning an error (or converting) for maps with non-string keys | `ToStringMapIntE(map[int]int{0: 0})` → panic in `reflect.Value.SetMapIndex` | ✓ |
| [hako/durafmt](https://github.com/hako/durafmt) (Go) | Formatting a negative duration negates it in place, so the second `String()` call returns `"-"` | `d := Parse(-time.Microsecond); d.String(); d.String()` → `"-"` | ✓ |
| [agext/levenshtein](https://github.com/agext/levenshtein) (Go) | With `maxCost`, `Calculate` returns an in-budget distance that is wrong | `Calculate("aaa", "bbbab", 2, 1, 2, 2)` → 2 (the true distance, with `maxCost` 0, is 6) | |
| [agext/levenshtein](https://github.com/agext/levenshtein) (Go) | `BonusPrefix` set after `BonusScale` skips the clamp, so `Match` scores above 1 | `NewParams().BonusScale(0.25).BonusPrefix(10)`, `Match("a…ab", "a…ac", p)` → 1.075 | |
| [isodate](https://github.com/gweis/isodate) (Python) | Fractional hours with many 9s round the microseconds up to 1000000 and crash | `parse_time("10.99999999999999")` → `ValueError: microsecond must be in 0..999999` | ✓ |
| [num2words](https://github.com/savoirfairelinux/num2words) (Python) | Bengali currency reads 0.01 as ten paisa | `num2words(0.01, lang='bn', to='currency')`: "শূন্য টাকা দশ পয়সা" | ✓ |
| [num2words](https://github.com/savoirfairelinux/num2words) (Python) | Bengali cardinals drop zeros after the decimal point | `1.05` reads the same as `1.5` | ✓ |
| [humanfriendly](https://github.com/xolox/python-humanfriendly) (Python) | `detailed=True` returns an empty string for zero | `format_timespan(0, detailed=True)` → `''` (`format_timespan(0)` is `'0 seconds'`) | ✓ |
| [titlecase](https://github.com/ppannuto/python-titlecase) (Python) | `set_small_word_list()` rebuilds a regex without the dash separators, so resetting to the default list changes the output (the project's own test for this is skipped with a FIXME) | `titlecase('foo - the end')` → `'Foo - the End'` after the reset | ✓ |
| [uritemplate](https://github.com/python-hyper/uritemplate) (Python) | The prefix modifier crashes on numbers | `expand('{a:1}', {'a': 12})` → `TypeError: 'int' object is not subscriptable` | |
| [uritemplate](https://github.com/python-hyper/uritemplate) (Python) | Reserved expansion leaves a space unencoded once the value contains any `%XX` escape (RFC 6570 §3.2.3) | `expand('{+x}', {'x': 'a b%41'})` → `'a b%41'` | |
| [query-string](https://github.com/sindresorhus/query-string) (JS) | `stringifyUrl` corrupts an index-format array already in the URL | `stringifyUrl({url: 'https://foo.bar?a[0]=x&a[1]=y', query: {}}, {arrayFormat: 'index', encode: false})` → `'…?a=[object Object]'` | ✓ |
| [fast-json-stable-stringify](https://github.com/epoberezkin/fast-json-stable-stringify) (JS) | Cycles made only of arrays are not detected; `cycles: true` is ignored | `const a = []; a.push(a); stringify(a, {cycles: true})` → `RangeError` | ✓ |
| [dot-prop](https://github.com/sindresorhus/dot-prop) (JS) | `stringifyPath` emits an index that `parsePath` rejects | `stringifyPath([1e21])` → `'[1e+21]'` | ✓ |
| [jsemver](https://github.com/zafarkhaja/jsemver) (Java) | `"0"` is not treated as a numeric identifier | `Version.parse("1.0.0-alpha.0").nextPreReleaseVersion()` → `1.0.0-alpha.0.1` | ✓ |
| [jsemver](https://github.com/zafarkhaja/jsemver) (Java) | Numeric pre-release identifiers rank above alphanumeric ones that start with `-` (SemVer §11) | `1.0.0-1` compares greater than `1.0.0--a` | ✓ |
| [java-string-similarity](https://github.com/tdebatty/java-string-similarity) (Java) | A negative threshold, documented to give plain Jaro, still adds the Winkler bonus | `new JaroWinkler(-1).similarity("ab", "ac")` → 0.7, not 2/3 | ✓ |
| [jsoup](https://github.com/jhy/jsoup) (Java) | The selector parser trims an escaped trailing space, so `escapeCssIdentifier`'s own output does not match | element with id `"a "`, `select("#" + escapeCssIdentifier("a "))` → no match | ✓ |
| [commons-codec](https://github.com/apache/commons-codec) (Java) | Strict quoted-printable encoding can emit a 77-character line (RFC 1521 allows 76) | `new QuotedPrintableCodec(true).encode("a"×70 + "\0\0aa")` | |

Debatable:

- [change-case](https://github.com/blakeembrey/change-case) (JS): words that start with an astral-plane letter are not capitalised, because `word[0]` splits a surrogate pair (`pascalSnakeCase('\u{10428}a')`). Real, but the scripts involved are rare. Patch ✓.
- [cron-parser](https://github.com/harrisiirak/cron-parser) (JS): `seededRandom('')` treats an empty seed as no seed, so it is not deterministic. Patch ✓.
- [humansize](https://github.com/LeopoldArkham/humansize) (Rust): `-1` formats as `"-1 Bytes"` while `1` is `"1 Byte"`. Patch ✓.
- [gobwas/glob](https://github.com/gobwas/glob) (Go): `Lexer.Offset()` points past the whole character class for tokens inside it, so parse errors there report the wrong position.
- [agext/levenshtein](https://github.com/agext/levenshtein) (Go): `Similarity("", "a", NewParams().InsCost(0))` is `NaN`, from 0/0.
- [uritemplate](https://github.com/python-hyper/uritemplate) (Python): `partial('a{x}b', {'x': ''})` keeps `{x}`, while `expand` drops it.
- [byte-unit](https://github.com/magiclen/byte-unit) (Rust): `Byte::from_f64_with_unit(1e-29, Unit::B)` is `Byte(0)`, while `Byte::from_f64(1e-29)` rounds up to `Byte(1)` as documented.

No bugs reported in: more-itertools, tabulate, furl, python-json-pointer, pathspec, path-to-regexp, parse-duration, filenamify, decamelize, commons-lang, commons-text, commons-csv, dtolnay/semver, unicode-width, shell-words, shlex, rust-lang/glob, wildmatch, blang/semver, go-runewidth, stringy.
Not run: pluralize (a UMD module the scanner cannot see into), slugify (Java dependencies not resolved), timeago (no `go.mod`).

## Stateful classes

Run on 12 libraries whose public API is a class that changes its own state (caches, ordered sets, queues, a state machine), with the
model-based testing and fixture reuse added on 2026-10-18: 6 Python (cachetools, bidict, sortedcontainers, pqdict, ordered-set,
transitions) and 6 JavaScript (lru-cache, quick-lru, yocto-queue, tinyqueue, denque, mnemonist). 17 modules, 93 functions, Claude Sonnet,
`--max-modules 2 --budget 0.6`, about $3.30 in total (6 reported → 6 reproduced → 6 confirmed; nothing rejected).
Hand-checking the 6 against the source: all 6 are clear bugs, none debatable, none wrong. The hunter wrote state machines for every class
(for cachetools, five of them) and correctly withheld one FIFO-cache finding that the code does on purpose.

| Library | Bug | Repro |
|---|---|---|
| [ordered-set](https://github.com/rspeer/ordered-set) (Python) | `pop(index)` never renumbers the position map, unlike `discard`, so `index()` is wrong afterwards | `s = OrderedSet([0, 1]); s.pop(0); s.index(1)` → `1` (the set is `[1]`) |
| [ordered-set](https://github.com/rspeer/ordered-set) (Python) | `symmetric_difference_update` does not de-duplicate `other`, so the set holds duplicates | `s = OrderedSet(); s.symmetric_difference_update([0, 0]); list(s)` → `[0, 0]` |
| [transitions](https://github.com/pytransitions/transitions) (Python) | `remove_transition` tests `hasattr(source, 'name')` on the whole list instead of each element, so a list of `State` objects removes nothing | `m.remove_transition('go', source=[m.get_state('A')])` leaves `A → B` in place (a single `State` works) |
| [denque](https://github.com/invertase/denque) (JS) | `removeOne` accepts a negative index but picks the shifting branch with the raw one, corrupting the queue | `new Denque([1, 2]).removeOne(-1)` returns 2, the queue becomes `[undefined]` |
| [denque](https://github.com/invertase/denque) (JS) | `remove(index, count)` with a negative index and `count > 1` uses the raw index in every branch after normalising it | `new Denque([1, 2, 3, 4]).remove(-3, 2)` → `[2, 3]`, queue becomes `[undefined, 1, 2, 3, 4]` |
| [lru-cache](https://github.com/isaacs/node-lru-cache) (JS) | `load()` overwrites `start` on the caller's dump entries with a `performance.now()`-relative value, so loading the same dump twice makes the entries stale | `b.load(d); c.load(d); c.get(1)` → `undefined` |

No bugs reported in: cachetools, bidict, sortedcontainers, pqdict, quick-lru, yocto-queue, tinyqueue, mnemonist.

## HTTP APIs

Run with `--api` on 5 small open-source web applications, with the route scanning added on 2026-10-18: four Flask/FastAPI apps in Python
(the [Flask tutorial](https://github.com/pallets/flask/tree/main/examples/tutorial) `flaskr`, [flaskr-tdd](https://github.com/mjhea0/flaskr-tdd),
Miguel Grinberg's [microblog](https://github.com/miguelgrinberg/microblog) REST API, the [SQLModel](https://github.com/fastapi/sqlmodel) FastAPI
testing tutorial app) and one in TypeScript ([json-server](https://github.com/typicode/json-server)). 39 routes, Claude Sonnet,
`--max-modules 2 --budget 0.8`, about $1.90 and 26 minutes in total (6 reported → 6 reproduced → 5 confirmed, 1 rejected by the reviewer).
Hand-checking the 5 against the source: all 5 are real, all are "a client error turns into a 500" or "an unknown name is not a 404", so
they are small, and 4 of the 5 apps are tutorials. The rejection was right too: flaskr-tdd's `/delete/<id>` answering "deleted" for a post
that does not exist is covered by the project's own test, so the reviewer read `tests/app_test.py` and withdrew the finding.
The hunter used the projects' own fixtures (`client`, `auth`, `clear_sqlmodel`) and an in-process client for every app; the Express app
was driven through a loopback port.

| Project | Bug | Repro |
|---|---|---|
| [Flask tutorial](https://github.com/pallets/flask/tree/main/examples/tutorial) (Python) | `<int:id>` accepts any integer, but `get_post` binds it straight into SQLite, so an id above 2⁶³−1 is an `OverflowError` (500) instead of the documented 404 | `client.get("/9223372036854775808/update")` → 500 |
| [microblog](https://github.com/miguelgrinberg/microblog) (Python) | `POST /api/users` checks that `password` is present but not that it is a string, so `null` reaches `generate_password_hash` and crashes | `POST /api/users {"username":"a","email":"a@x.org","password":null}` → 500 |
| [microblog](https://github.com/miguelgrinberg/microblog) (Python) | `POST /api/users` and `PUT /api/users/<id>` run `'username' in data` without checking that the JSON body is an object | `PUT /api/users/1` with body `0` → `TypeError` (500) |
| [SQLModel](https://github.com/fastapi/sqlmodel) FastAPI tutorial (Python) | `HeroUpdate` declares `name: str \| None`, so `{"name": null}` validates, is applied with `exclude_unset=True`, and fails the NOT NULL constraint at commit | `PATCH /heroes/1 {"name": null}` → 500 instead of 422 |
| [json-server](https://github.com/typicode/json-server) (TypeScript) | `Service.#get` returns `db.data[name]` without an own-property check, so `constructor`, `toString`… resolve to `Object.prototype` and `PUT /toString` writes a new key into the database | `GET /constructor` → 200 with an empty body; `PUT /toString {"a":1}` → 200 and `db.data.toString` exists |

No bugs reported in: flaskr-tdd (one finding withdrawn by the reviewer).

## counterhound on itself

Run on its own source (`--max-modules 6 --fix`, 22 functions, 5 minutes, $1.55): 7 reported → 7 reproduced → 6 confirmed, 1 the reviewer was unsure about.
All 7 were real and are fixed, with regression tests in `test/unit.test.js`. Three of the fixes are the patches `--fix` wrote, unchanged.

- `parseDiff` read an added line whose content starts with `++ ` as a new file header (patch from `--fix`)
- `parseGoJson` blamed a package-level panic on tests that had already failed for another reason (patch from `--fix`)
- `fmtMs(119500)` printed `1m60s` (patch from `--fix`)
- `relPath` treated a child folder named `..foo` as outside the root
- `parseJavaTrace` kept the frames of tab-indented `Suppressed:` exceptions
- `extractJSON` returned the first object of `Result: [{...}, {...}]` instead of the array
- `parseLibtest` missed `#[should_panic]` tests entirely (the one the reviewer was unsure about)

## Reported upstream

Filed on 2026-10-19 and 2026-10-20, each with the minimal repro, the cause and a one-line fix (issue texts in [showcase-runs/upstream](showcase-runs/upstream)). Status as of 2026-10-26: 3 fixed upstream, 6 with a fix under review, 2 waiting.

| Project | Bug | Report | Status |
|---|---|---|---|
| lru-cache | `load()` rewrites the caller's dump, a second `load()` of it is all stale | [isaacs/node-lru-cache#421](https://github.com/isaacs/node-lru-cache/issues/421) | fix PR [#422](https://github.com/isaacs/node-lru-cache/pull/422) under review |
| transitions | `remove_transition` with a list of `State` objects removes nothing | [pytransitions/transitions#750](https://github.com/pytransitions/transitions/issues/750) | fix PR [#751](https://github.com/pytransitions/transitions/pull/751) under review |
| json-server | `GET /constructor` is 200, `PUT /toString` writes a key into the database | [typicode/json-server#1780](https://github.com/typicode/json-server/issues/1780) | fix PR [#1781](https://github.com/typicode/json-server/pull/1781) under review |
| query-string | `stringifyUrl` turns an index-format array into `a=[object Object]` | [sindresorhus/query-string#422](https://github.com/sindresorhus/query-string/issues/422), fix on a branch | **fixed** by the maintainer in [f016142](https://github.com/sindresorhus/query-string/commit/f01614265b209743719b3195b1cc6129b82b8515) |
| dot-prop | `stringifyPath([1e21])` is not parseable | [sindresorhus/dot-prop#131](https://github.com/sindresorhus/dot-prop/issues/131), fix on a branch | waiting |
| parse | fields after a `%z` datetime format are shifted | [r1chardj0n3s/parse#262](https://github.com/r1chardj0n3s/parse/issues/262) | **fixed**, [PR #263](https://github.com/r1chardj0n3s/parse/pull/263) merged |
| rfc3986 | `ParseResultBytes.unsplit()` crashes without an authority | [python-hyper/rfc3986#163](https://github.com/python-hyper/rfc3986/issues/163) | fix PR [#166](https://github.com/python-hyper/rfc3986/pull/166) under review |
| rfc3986 | `extend_query_with` drops parameters with an empty value | [python-hyper/rfc3986#164](https://github.com/python-hyper/rfc3986/issues/164) | waiting |
| qs | `stringify` sorts the caller's `filter` array in place | [ljharb/qs#628](https://github.com/ljharb/qs/issues/628) | fix PR [#637](https://github.com/ljharb/qs/pull/637) under review |
| qs | `comma: true` is ignored with `iso-8859-1` and `interpretNumericEntities` | [ljharb/qs#629](https://github.com/ljharb/qs/issues/629) | **fixed**, [PR #630](https://github.com/ljharb/qs/pull/630) approved and merged by the maintainer |
| uritemplate | prefix modifier crashes on numbers; reserved expansion stops encoding after a `%XX` | [python-hyper/uritemplate#163](https://github.com/python-hyper/uritemplate/issues/163) | fix PR [#165](https://github.com/python-hyper/uritemplate/pull/165) under review |

Found by counterhound but already known upstream when checked: go-version `Compare` ([#216](https://github.com/hashicorp/go-version/issues/216)), slug empty output ([PR #96](https://github.com/gosimple/slug/pull/96)), cast `ToStringMapIntE` panic ([PR #359](https://github.com/spf13/cast/pull/359)), toolz `memoize` ([PR #638](https://github.com/pytoolz/toolz/pull/638)), ordered-set `pop` ([#83](https://github.com/rspeer/ordered-set/issues/83)), rfc3986 path becoming an authority ([PR #155](https://github.com/python-hyper/rfc3986/pull/155)). Not reportable: denque (repository archived), jsoup (the project does not take AI-assisted contributions).

