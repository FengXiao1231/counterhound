# from_f64_with_unit/from_f32_with_unit return Byte(0) for positive sizes below 1e-28, unlike from_f64/from_f32

| | |
|---|---|
| Function | `byte_unit::Byte::from_f64_with_unit (also from_f32_with_unit)` in `src/byte/mod.rs` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.60, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** from_f64_with_unit(1e-29, Unit::B) (and from_f32_with_unit(1e-29, Unit::B))

**Expected:** Some(Byte(1)), as from_f64(1e-29) returns

**Actual:** Some(Byte(0))

## Reproduce

```rust
use byte_unit::{Byte, Unit};

#[test]
fn repro_tiny_positive_rounds_to_zero() {
    // documented: "The calculated byte will be rounded up", so a positive size must give >= 1 byte
    assert_eq!(Byte::from_f64(1e-29).unwrap().as_u64(), 1);
    assert_eq!(Byte::from_f64_with_unit(1e-29, Unit::B).unwrap().as_u64(), 1);
}

#[test]
fn repro_tiny_positive_rounds_to_zero_f32() {
    assert_eq!(Byte::from_f32(1e-29).unwrap().as_u64(), 1);
    assert_eq!(Byte::from_f32_with_unit(1e-29, Unit::B).unwrap().as_u64(), 1);
}
```

Fails with `AssertionError: assertion `left == right` failed`

Copy it into `tests/repro_tiny_positive_rounds_to_zero.rs` and run `cargo test --test repro_tiny_positive_rounds_to_zero`.

## Why this is a bug

Docs: 'The calculated byte will be rounded up.' from_f64 documents 'The fractional part will be rounded up' and returns 1 for 1e-29. The Decimal conversion (Decimal::from_f64) silently flattens values below 1e-28 to zero before the ceil.

Independent review: Both functions document 'The calculated byte will be rounded up', and Byte::from_f64(1e-29) returns Byte(1) via ceil. The _with_unit variants first convert through rust_decimal's Decimal::from_f64, which cannot represent values below 1e-28 and returns zero. A positive size therefore becomes Byte(0), and the same input gives different results depending on the entry point. The input is valid (>= 0) and the repro uses the API correctly. The case is extremely obscure, and a maintainer could treat it as a limit of the Decimal dependency. A small clamp (positive input with a zero result becomes 1) would fix it.

## How it was found

Property: *A positive size is rounded up to at least 1 byte, and from_f64_with_unit(x, Unit::B) equals from_f64(x)*.


---
Found by [counterhound](https://github.com/FengXiao1231/counterhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
