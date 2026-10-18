<!-- counterhound-report -->
### counterhound found 1 provable bug

Checked 12 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> from_f64_with_unit/from_f32_with_unit return Byte(0) for positive sizes below 1e-28, unlike from_f64/from_f32 <sub>(wrong result, src/byte/mod.rs)</sub></summary>

| | |
|---|---|
| Function | `byte_unit::Byte::from_f64_with_unit (also from_f32_with_unit)` |
| Input | from_f64_with_unit(1e-29, Unit::B) (and from_f32_with_unit(1e-29, Unit::B)) |
| Expected | Some(Byte(1)), as from_f64(1e-29) returns |
| Actual | Some(Byte(0)) |
| Review | low severity, confidence 0.60 |

Both functions document 'The calculated byte will be rounded up', and Byte::from_f64(1e-29) returns Byte(1) via ceil. The _with_unit variants first convert through rust_decimal's Decimal::from_f64, which cannot represent values below 1e-28 and returns zero. A positive size therefore becomes Byte(0), and the same input gives different results depending on the entry point. The input is valid (>= 0) and the repro uses the API correctly. The case is extremely obscure, and a maintainer could treat it as a limit of the Decimal dependency. A small clamp (positive input with a zero result becomes 1) w

Failing test (`repro_tiny_positive_rounds_to_zero.rs`, failed 3/3 runs):

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
</details>

<sub>1m26s · $0.51 of model usage · [counterhound](https://github.com/FengXiao1231/counterhound) only reports failures that replay deterministically and survive review.</sub>
