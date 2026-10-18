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
