use humansize::{FormatSizeOptions, BaseUnit, Kilo, DECIMAL, BINARY, WINDOWS};
use proptest::prelude::*;

fn kilo() -> impl Strategy<Value = Kilo> { prop_oneof![Just(Kilo::Decimal), Just(Kilo::Binary)] }
fn bu() -> impl Strategy<Value = BaseUnit> { prop_oneof![Just(BaseUnit::Bit), Just(BaseUnit::Byte)] }
fn base() -> impl Strategy<Value = FormatSizeOptions> {
    prop_oneof![Just(DECIMAL), Just(BINARY), Just(WINDOWS), Just(FormatSizeOptions::default())]
}
fn same(a: FormatSizeOptions, b: FormatSizeOptions) -> bool { format!("{:?}", a) == format!("{:?}", b) }

proptest! {
    #[test] fn ph_base_unit(o in base(), b in bu()) {
        let r = o.base_unit(b);
        prop_assert_eq!(r.base_unit, b);
        prop_assert!(same(r.base_unit(o.base_unit), o));
    }
    #[test] fn ph_kilo(o in base(), k in kilo()) {
        let r = o.kilo(k);
        prop_assert_eq!(r.kilo, k);
        prop_assert!(same(r.kilo(o.kilo), o));
    }
    #[test] fn ph_units(o in base(), k in kilo()) {
        let r = o.units(k);
        prop_assert_eq!(r.units, k);
        prop_assert_eq!(r.kilo, o.kilo);
        prop_assert!(same(r.units(o.units), o));
    }
    #[test] fn ph_dp(o in base(), n in any::<usize>()) {
        let r = o.decimal_places(n);
        prop_assert_eq!(r.decimal_places, n);
        prop_assert_eq!(r.decimal_zeroes, o.decimal_zeroes);
        prop_assert!(same(r.decimal_places(o.decimal_places), o));
    }
    #[test] fn ph_sep(o in base(), c in proptest::option::of(any::<char>())) {
        let r = o.thousands_separator(c);
        prop_assert_eq!(r.thousands_separator, c);
        prop_assert!(same(r.thousands_separator(o.thousands_separator), o));
    }
    #[test] fn ph_from(o in base()) { prop_assert!(same(FormatSizeOptions::from(o), o)); }
}
