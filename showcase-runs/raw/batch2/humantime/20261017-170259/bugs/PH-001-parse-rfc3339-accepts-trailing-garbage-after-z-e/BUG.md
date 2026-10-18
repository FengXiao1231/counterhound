# parse_rfc3339 accepts trailing garbage after 'Z' (e.g. "...00ZZ")

| | |
|---|---|
| Function | `humantime::parse_rfc3339` in `src/date.rs` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.85, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** 1970-01-01T00:00:00ZZ

**Expected:** Err(Error::InvalidFormat) (or other error)

**Actual:** Ok(UNIX_EPOCH): weak parser only checks b[19]=='Z' and len<=25, ignoring the remaining bytes

## Reproduce

```rust
use humantime::parse_rfc3339;

#[test]
fn repro_trailing_garbage() {
    assert!(parse_rfc3339("1970-01-01T00:00:00ZZ").is_err());
    assert!(parse_rfc3339("1970-01-01T00:00:00Zabc+00:00").is_err());
}
```

Fails with `AssertionError: assertion failed: parse_rfc3339("1970-01-01T00:00:00ZZ").is_err()`

Copy it into `tests/repro_trailing_garbage.rs` and run `cargo test --test repro_trailing_garbage`.

## Why this is a bug

Docs say parse_rfc3339 is for strictly programmatically generated strings; only 'Z' or '+00:00' suffix is supported. 'ZZ' and 'Zabc+00:00' are not valid RFC3339 (the crate's own tests reject '+00:00abcd' and similar trailing junk).

Independent review: The strict `parse_rfc3339` only checks that the last byte is 'Z' or that the string ends with "+00:00", then hands off to `parse_rfc3339_weak`. In the weak parser, the no-fraction branch at date.rs:187 rejects the input only when `len > 25` or `b[19]` is neither 'Z' nor the full "+00:00". As a result, "…00ZZ" and "…00Zabc+00:00" (up to 25 bytes) pass, even though the docs say only `Z` or `+00:00` is supported for this strict function. The fix is simple (require `b.len()==20` with 'Z', or exactly `+00:00` at b[19..]), so a maintainer would likely accept it, though the impact is minor.

## How it was found

Property: *a timestamp with extra characters between the seconds and the final Z is not a valid RFC3339 timestamp and must be rejected*.

proptest shrank the failure to: `Failing test case: s = 0, g = "Z"`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
