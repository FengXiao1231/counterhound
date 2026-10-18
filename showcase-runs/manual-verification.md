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
The raw run's patches also contained a hunk for the run's own log file (ph-err.txt); proofhound now diffs against a snapshot, and the
copies here have those hunks removed. 9 bugs got no patch because the per-library --budget 0.5 was used up (now --fix-budget).
