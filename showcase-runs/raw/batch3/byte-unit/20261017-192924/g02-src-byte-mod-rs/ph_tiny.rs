use byte_unit::{Byte, Unit};
use proptest::prelude::*;

proptest! {
    #[test]
    fn ph_tiny_positive_rounds_up_f64(e in 29i32..300, m in 1.0f64..9.9, u in prop_oneof![Just(Unit::B),Just(Unit::KB),Just(Unit::Bit)]) {
        let x = m * 10f64.powi(-e);
        prop_assert_eq!(Byte::from_f64_with_unit(x, u).map(|b| b.as_u64()), Some(1));
    }
    #[test]
    fn ph_tiny_positive_rounds_up_f32(e in 29i32..37, m in 1.0f32..9.9) {
        let x = m * 10f32.powi(-e);
        prop_assert_eq!(Byte::from_f32_with_unit(x, Unit::B).map(|b| b.as_u64()), Some(1));
    }
    #[test]
    fn ph_tiny_negative_none(e in 29i32..300, m in 1.0f64..9.9) {
        let x = -m * 10f64.powi(-e);
        prop_assert!(Byte::from_f64_with_unit(x, Unit::B).is_none());
        prop_assert!(Byte::from_f64(x).is_none());
    }
}
