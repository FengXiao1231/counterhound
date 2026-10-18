// NOTE: the `impl_style` feature is not enabled in this harness, so FormatSize /
// FormatSizeI are not reachable. These wrappers are exactly
// `format!("{}", SizeFormatter::new(*self, opts))` / `ISizeFormatter::new(..)`.
use humansize::{BaseUnit, FormatSizeOptions, ISizeFormatter, Kilo, SizeFormatter, DECIMAL};
use proptest::prelude::*;

fn fs(v: u64, o: FormatSizeOptions) -> String { format!("{}", SizeFormatter::new(v, o)) }
fn fsi(v: i64, o: FormatSizeOptions) -> String { format!("{}", ISizeFormatter::new(v, o)) }

fn opts(binary: bool, bits: bool, long: bool, places: usize, zeroes: usize, space: bool) -> FormatSizeOptions {
    let k = if binary { Kilo::Binary } else { Kilo::Decimal };
    DECIMAL.kilo(k).units(k)
        .base_unit(if bits { BaseUnit::Bit } else { BaseUnit::Byte })
        .long_units(long).decimal_places(places).decimal_zeroes(zeroes).space_after_value(space)
}

proptest! {
    #[test]
    fn ph_signed_matches_unsigned(v in 0i64..i64::MAX, b: bool, bits: bool, long: bool, p in 0usize..5, z in 0usize..3, s: bool) {
        let o = opts(b, bits, long, p, z, s);
        prop_assert_eq!(fs(v as u64, o), fsi(v, o));
    }
    #[test]
    fn ph_negation_symmetry(v in 1i64..i64::MAX, b: bool, bits: bool, long: bool, p in 0usize..5, z in 0usize..3, s: bool) {
        let o = opts(b, bits, long, p, z, s);
        prop_assert_eq!(fsi(-v, o), format!("-{}", fsi(v, o)));
    }
    #[test]
    fn ph_separator_agrees(v in 0u64..1_000_000_000_000, b: bool, p in 0usize..5, z in 0usize..3) {
        let o = opts(b, false, false, p, z, true);
        let a = fs(v, o);
        let c = fs(v, o.thousands_separator(Some('_')));
        prop_assert_eq!(a.replace('_', ""), c.replace('_', ""));
    }
    #[test]
    fn ph_long_singular_plural(v in -3i64..3) {
        let o = DECIMAL.long_units(true).space_after_value(true);
        let r = fsi(v, o);
        if v.abs() == 1 { prop_assert!(r.ends_with("Byte"), "{}", r); }
        else { prop_assert!(r.ends_with("Bytes"), "{}", r); }
    }
    #[test]
    fn ph_no_panic_u64(v: u64, b: bool, bits: bool, long: bool, p in 0usize..5, sep: bool) {
        let mut o = opts(b, bits, long, p, 0, true);
        if sep { o = o.thousands_separator(Some(',')); }
        let _ = fs(v, o);
    }
}
