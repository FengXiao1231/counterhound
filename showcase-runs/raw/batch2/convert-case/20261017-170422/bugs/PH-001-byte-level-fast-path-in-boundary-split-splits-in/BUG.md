# Byte-level fast path in boundary::split splits inside grapheme clusters, unlike the general path

| | |
|---|---|
| Function | `convert_case::StateConverter::set_boundaries / to_case (via boundary::split)` in `src/lib.rs` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** " \u{301}".set_boundaries(&[Space]).to_case(Snake) vs .set_boundaries(&[Space, LowerUpper])

**Expected:** same result for both; the doc says splitting is by graphemes, where ' '+U+0301 is a single non-space grapheme, so no split occurs (result " \u{301}" -> "_\u{301}" not produced)

**Actual:** [Space] only: "_\u{301}" (split inside the grapheme cluster, byte-level fast path); with an extra irrelevant boundary: " \u{301}" (grapheme path, no split)

## Reproduce

```rust
use convert_case::{Boundary, Case, Casing};

#[test]
fn repro_fast_vs_general_path() {
    let s = " \u{301}"; // space + combining acute: one grapheme cluster
    // LowerUpper can never match in this string, so it must not change the result.
    let only_space = s.set_boundaries(&[Boundary::Space]).to_case(Case::Snake);
    let with_extra = s
        .set_boundaries(&[Boundary::Space, Boundary::LowerUpper])
        .to_case(Case::Snake);
    assert_eq!(only_space, with_extra);
}
```

Fails with `AssertionError: assertion `left == right` failed`

Copy it into `tests/repro_fast_vs_general_path.rs` and run `cargo test --test repro_fast_vs_general_path`.

## Why this is a bug

boundary::split has a byte-level fast path when all boundaries are Space/Hyphen/Underscore and a grapheme-cluster path otherwise; the General path comment says it needs graphemes, and Boundary::len docs count graphemes. The same string and same effective delimiters give different words depending on unrelated boundaries.

Independent review: The fast path's comment says byte iteration is correct because the delimiters are ASCII. That ignores that a delimiter followed by a combining mark (' ' + U+0301) is a single grapheme, which the general path (the documented, grapheme-based one) does not split. Adding an unrelated boundary such as LowerUpper therefore changes the output for the same effective delimiters. The input is valid and the fix is small (fall back to the grapheme path when the string has non-ASCII bytes), though the case is rare and so low severity.

## How it was found

Property: *adding a boundary that cannot match anywhere in the input does not change the conversion result*.

proptest shrank the failure to: `Failing test case: s = " \u{301}", bs = [ Space, ], c = Snake`

---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
