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

