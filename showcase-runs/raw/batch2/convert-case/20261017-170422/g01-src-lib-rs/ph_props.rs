use convert_case::{Boundary, Case, Casing, Converter};
use proptest::prelude::*;

fn case_strat() -> impl Strategy<Value = Case<'static>> {
    (0..Case::all_cases().len()).prop_map(|i| Case::all_cases()[i])
}

fn bnd_strat() -> impl Strategy<Value = Vec<Boundary>> {
    proptest::collection::vec(
        prop_oneof![
            Just(Boundary::Hyphen),
            Just(Boundary::Underscore),
            Just(Boundary::Space),
            Just(Boundary::LowerUpper),
            Just(Boundary::UpperLower),
            Just(Boundary::LowerDigit),
            Just(Boundary::UpperDigit),
            Just(Boundary::DigitLower),
            Just(Boundary::DigitUpper),
            Just(Boundary::Acronym),
        ],
        0..6,
    )
}

const S: &str = "[a-zA-Z0-9_ \\-]{0,20}";

proptest! {
    #[test]
    fn ph_no_panic(s in "\\PC{0,20}", a in case_strat(), b in case_strat()) {
        let _ = s.from_case(a).to_case(b);
        let _ = s.to_case(b);
    }

    #[test]
    fn ph_from_case_matches_converter(s in S, a in case_strat(), b in case_strat()) {
        let expected = Converter::new().from_case(a).to_case(b).convert(&s);
        prop_assert_eq!(s.from_case(a).to_case(b), expected);
    }

    #[test]
    fn ph_from_case_overwrites(s in S, a in case_strat(), b in case_strat(), c in case_strat()) {
        prop_assert_eq!(s.from_case(a).from_case(b).to_case(c), s.from_case(b).to_case(c));
    }

    #[test]
    fn ph_set_boundaries_overwrites(s in S, a in case_strat(), bs in bnd_strat(), c in case_strat()) {
        prop_assert_eq!(
            s.from_case(a).set_boundaries(&bs).to_case(c),
            s.set_boundaries(&bs).to_case(c)
        );
    }

    #[test]
    fn ph_remove_boundaries_is_set_difference(s in S, a in case_strat(), bs in bnd_strat(), c in case_strat()) {
        let rest: Vec<Boundary> = a.boundaries().iter().copied().filter(|x| !bs.contains(x)).collect();
        prop_assert_eq!(
            s.from_case(a).remove_boundaries(&bs).to_case(c),
            s.set_boundaries(&rest).to_case(c)
        );
    }

    #[test]
    fn ph_default_equals_to_case(s in S, c in case_strat()) {
        prop_assert_eq!(s.to_case(c), Converter::new().to_case(c).convert(&s));
    }

    // fast byte path vs general grapheme path
    #[test]
    fn ph_fast_vs_general_path(s in "[a-zA-Z0-9_ \\-\u{301}]{0,20}", bs in proptest::collection::vec(
        prop_oneof![Just(Boundary::Hyphen), Just(Boundary::Underscore), Just(Boundary::Space)], 0..4), c in case_strat()) {
        let never = Boundary::Custom { condition: |_| false, start: 0, len: 0 };
        let mut bs2 = bs.clone();
        bs2.push(never);
        prop_assert_eq!(s.set_boundaries(&bs).to_case(c), s.set_boundaries(&bs2).to_case(c));
    }

    #[test]
    fn ph_snake_idempotent(s in S) {
        let once = s.to_case(Case::Snake);
        prop_assert_eq!(once.to_case(Case::Snake), once);
    }

    #[test]
    fn ph_lower_case_chars(s in "[a-zA-Z0-9_ \\-]{0,20}") {
        let r = s.to_case(Case::Flat);
        prop_assert!(!r.chars().any(|c| c.is_ascii_uppercase() || c == '_' || c == '-' || c == ' '));
    }
}
