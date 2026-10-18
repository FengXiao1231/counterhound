use byte_unit::{Byte, Unit};
use proptest::prelude::*;

fn big(b: Byte) -> u128 { b.as_u64() as u128 }

proptest! {
    #[test]
    fn ph_u128_bounds(n in any::<u128>()) {
        let r = Byte::from_u128(n);
        prop_assert_eq!(r.is_some(), n <= u64::MAX as u128);
        if let Some(b) = r { prop_assert_eq!(big(b), n); }
    }
    #[test]
    fn ph_i128(n in any::<i128>()) {
        let r = Byte::from_i128(n);
        prop_assert_eq!(r.is_some(), n >= 0 && n <= u64::MAX as i128);
        if let Some(b) = r { prop_assert_eq!(big(b) as i128, n); }
    }
    #[test]
    fn ph_f64_ceil(x in 0.0f64..1e18) {
        let b = Byte::from_f64(x).unwrap();
        prop_assert_eq!(big(b), x.ceil() as u128);
    }
    #[test]
    fn ph_f32_ceil(x in 0.0f32..1e18) {
        let b = Byte::from_f32(x).unwrap();
        prop_assert_eq!(big(b), x.ceil() as u128);
    }
    #[test]
    fn ph_f64_neg(x in -1e18f64..-1e-300) {
        prop_assert!(Byte::from_f64(x).is_none());
        prop_assert!(Byte::from_f64_with_unit(x, Unit::B).is_none());
    }
    #[test]
    fn ph_f64_unit_agrees_b(x in 0.0f64..1e18) {
        prop_assert_eq!(Byte::from_f64_with_unit(x, Unit::B), Byte::from_f64(x));
    }
    #[test]
    fn ph_f32_unit_agrees_b(x in 0.0f32..1e18) {
        prop_assert_eq!(Byte::from_f32_with_unit(x, Unit::B), Byte::from_f32(x));
    }
    #[test]
    fn ph_f64_unit_int(n in 0u64..1_000_000, u in prop_oneof![Just(Unit::KB),Just(Unit::KiB),Just(Unit::MB),Just(Unit::GiB),Just(Unit::B),Just(Unit::Bit),Just(Unit::Kbit)]) {
        prop_assert_eq!(Byte::from_f64_with_unit(n as f64, u), Byte::from_u64_with_unit(n, u));
        prop_assert_eq!(Byte::from_f32_with_unit(n as f32, u), Byte::from_u64_with_unit(n, u));
    }
    #[test]
    fn ph_f64_large_exact(n in (1u64<<50)..(1u64<<62)) {
        let x = n as f64;
        prop_assert_eq!(Byte::from_f64_with_unit(x, Unit::B), Byte::from_f64(x));
    }
}
