# Bugs found by proofhound

Real bugs proofhound found in popular open-source libraries. Every entry was reproduced by
proofhound (the repro failed 3/3 in fresh processes), confirmed by its independent reviewer,
and then **re-run by hand** against the library's latest `main` on 2026-10-17.
None of these have been reported upstream yet.

Run: 25 libraries, 46 modules, 204 functions, Claude Sonnet, about 32 minutes of machine time and $9 in total
(23 reported → 21 reproduced → 20 confirmed; 1 rejected by review, 2 dropped as broken tests).
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
