use byte_unit::bit::Bit;
use byte_unit::unit::Unit;
use proptest::prelude::*;

fn units() -> impl Strategy<Value = Unit> {
    prop_oneof![
        Just(Unit::Bit), Just(Unit::Kbit), Just(Unit::Mbit), Just(Unit::Gbit),
        Just(Unit::Kibit), Just(Unit::Mibit), Just(Unit::Gibit),
    ]
}

proptest! {
    #[test]
    fn ph_u128_roundtrip(n in any::<u64>()) {
        prop_assert_eq!(Bit::from_u128(n as u128).unwrap().as_u128(), n as u128);
    }

    #[test]
    fn ph_i128_matches_u128(n in any::<i128>()) {
        if n < 0 { prop_assert!(Bit::from_i128(n).is_none()); }
        else { prop_assert_eq!(Bit::from_i128(n), Bit::from_u128(n as u128)); }
    }

    #[test]
    fn ph_f64_ceil(x in 0.0f64..1e15) {
        let b = Bit::from_f64(x).unwrap();
        prop_assert_eq!(b.as_u128(), x.ceil() as u128);
    }

    #[test]
    fn ph_f32_ceil(x in 0.0f32..1e7) {
        let b = Bit::from_f32(x).unwrap();
        prop_assert_eq!(b.as_u128(), x.ceil() as u128);
    }

    #[test]
    fn ph_f64_negative_none(x in -1e15f64..-1e-300) {
        prop_assert!(Bit::from_f64(x).is_none());
        prop_assert!(Bit::from_f64_with_unit(x, Unit::Bit).is_none());
    }

    #[test]
    fn ph_f64_unit_ceil(x in 0.0f64..1e6, u in units()) {
        let b = Bit::from_f64_with_unit(x, u).unwrap();
        let bits = u.as_bits_u128() as f64;
        let exact = x * bits;
        // allow tiny float noise: result within [exact-1.0001*..]
        let got = b.as_u128() as f64;
        prop_assert!(got >= exact * (1.0 - 1e-12) - 1e-9, "got {} exact {}", got, exact);
        prop_assert!(got <= exact + 1.0 + exact * 1e-12);
    }

    #[test]
    fn ph_f64_unit_tiny_positive_rounds_up(x in 1e-20f64..1e-3) {
        // a positive fractional amount of bits must round up to at least 1
        let b = Bit::from_f64_with_unit(x, Unit::Bit);
        prop_assert!(b.map(|b| b.as_u128() >= 1).unwrap_or(false), "{:?}", b);
    }

    #[test]
    fn ph_f64_vs_f64_unit_bit(x in 0.0f64..1e15) {
        prop_assert_eq!(Bit::from_f64(x), Bit::from_f64_with_unit(x, Unit::Bit));
    }

    #[test]
    fn ph_f32_vs_f32_unit_bit(x in 0.0f32..1e7) {
        prop_assert_eq!(Bit::from_f32(x), Bit::from_f32_with_unit(x, Unit::Bit));
    }

    #[test]
    fn ph_f32_unit_tiny_positive(x in 1e-20f32..1e-3) {
        let b = Bit::from_f32_with_unit(x, Unit::Bit);
        prop_assert!(b.map(|b| b.as_u128() >= 1).unwrap_or(false), "{:?}", b);
    }

    #[test]
    fn ph_f64_large_none(x in 1e30f64..1e300) {
        prop_assert!(Bit::from_f64(x).is_none());
        prop_assert!(Bit::from_f64_with_unit(x, Unit::Bit).is_none());
        prop_assert!(Bit::from_f32(x as f32).is_none());
    }

    #[test]
    fn ph_f64_integral_unit_matches_u128(n in 0u64..1_000_000, u in units()) {
        prop_assert_eq!(Bit::from_f64_with_unit(n as f64, u), Bit::from_u128_with_unit(n as u128, u));
    }

    #[test]
    fn ph_f64_max_boundary(d in 0u64..4096) {
        let x = 18446744073709551615.0f64 - (d as f64) * 2048.0;
        prop_assert!(Bit::from_f64(x).is_some() || x >= 18446744073709551615.0);
    }
}
