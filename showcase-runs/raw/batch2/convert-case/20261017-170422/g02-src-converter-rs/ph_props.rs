use convert_case::{Boundary, Case, Converter, Pattern};
use proptest::prelude::*;

fn case_strat() -> impl Strategy<Value = Case<'static>> {
    prop_oneof![
        Just(Case::Snake), Just(Case::Constant), Just(Case::UpperSnake), Just(Case::Ada),
        Just(Case::Kebab), Just(Case::Cobol), Just(Case::UpperKebab), Just(Case::Train),
        Just(Case::Flat), Just(Case::UpperFlat), Just(Case::Pascal), Just(Case::UpperCamel),
        Just(Case::Camel), Just(Case::Lower), Just(Case::Upper), Just(Case::Title),
        Just(Case::Sentence),
    ]
}

fn bound_strat() -> impl Strategy<Value = Boundary> {
    prop_oneof![
        Just(Boundary::Underscore), Just(Boundary::Hyphen), Just(Boundary::Space),
        Just(Boundary::LowerUpper), Just(Boundary::UpperLower), Just(Boundary::LowerDigit),
        Just(Boundary::UpperDigit), Just(Boundary::DigitLower), Just(Boundary::DigitUpper),
        Just(Boundary::Acronym),
    ]
}

fn pat_strat() -> impl Strategy<Value = Pattern> {
    prop_oneof![
        Just(Pattern::Lowercase), Just(Pattern::Uppercase), Just(Pattern::Capital),
        Just(Pattern::Camel), Just(Pattern::Sentence), Just(Pattern::RemoveEmpty),
    ]
}

proptest! {
    // Camel: "first non-empty word lowercase, remaining capitalized"
    #[test]
    fn ph_camel_leading_delims(s in "[a-z]{1,6}", t in "[a-z]{1,6}", n in 1usize..3) {
        let input = format!("{}{}-{}", "-".repeat(n), s, t);
        let out = Converter::new().from_case(Case::Kebab).to_case(Case::Camel).convert(&input);
        let first = s.to_lowercase();
        let mut cap = t.clone();
        cap[..1].make_ascii_uppercase();
        prop_assert_eq!(out, format!("{}{}", first, cap));
    }

    #[test]
    fn ph_sentence_leading_delims(s in "[a-z]{1,6}", t in "[a-z]{1,6}") {
        let input = format!("_{}_{}", s, t);
        let out = Converter::new().from_case(Case::Snake).to_case(Case::Sentence).convert(&input);
        let mut cap = s.clone();
        cap[..1].make_ascii_uppercase();
        prop_assert_eq!(out, format!(" {} {}", cap, t));
    }

    #[test]
    fn ph_to_case_matches_case_semantics(s in "\\PC{0,20}", c in case_strat()) {
        let a = Converter::new().from_case(c).to_case(c).convert(&s);
        let b = Converter::new().to_case(c).from_case(c).convert(&s);
        prop_assert_eq!(a, b);
    }

    #[test]
    fn ph_to_case_twice_equals_last(s in "[a-zA-Z0-9_ -]{0,20}", c1 in case_strat(), c2 in case_strat()) {
        let a = Converter::new().to_case(c1).to_case(c2).convert(&s);
        let b = Converter::new().to_case(c2).convert(&s);
        prop_assert_eq!(a, b);
    }

    #[test]
    fn ph_remove_boundary_gone(bs in proptest::collection::vec(bound_strat(), 0..6), b in bound_strat()) {
        let c = Converter::new().set_boundaries(&bs).remove_boundary(b);
        prop_assert!(!c.boundaries.contains(&b));
        prop_assert_eq!(c.boundaries.len(), bs.iter().filter(|x| **x != b).count());
    }

    #[test]
    fn ph_remove_boundaries_gone(bs in proptest::collection::vec(bound_strat(), 0..8), rm in proptest::collection::vec(bound_strat(), 0..5)) {
        let c = Converter::new().set_boundaries(&bs).remove_boundaries(&rm);
        let expect: Vec<_> = bs.iter().filter(|x| !rm.contains(x)).cloned().collect();
        prop_assert_eq!(c.boundaries, expect);
    }

    #[test]
    fn ph_remove_pattern(ps in proptest::collection::vec(pat_strat(), 0..6), p in pat_strat()) {
        let c = Converter::new().set_patterns(&ps).remove_pattern(p);
        let expect: Vec<_> = ps.iter().filter(|x| **x != p).cloned().collect();
        prop_assert_eq!(c.patterns, expect);
    }

    #[test]
    fn ph_from_case_sets_boundaries(c in case_strat(), bs in proptest::collection::vec(bound_strat(), 0..4)) {
        let conv = Converter::new().set_boundaries(&bs).from_case(c);
        prop_assert_eq!(conv.boundaries, c.boundaries().to_vec());
    }

    #[test]
    fn ph_convert_agrees_with_manual(s in "\\PC{0,20}", c in case_strat()) {
        let conv = Converter::new().from_case(c).to_case(c);
        let words = convert_case::split(&s, c.boundaries());
        let expect = c.join(&c.mutate(&words));
        prop_assert_eq!(conv.convert(&s), expect);
    }

    #[test]
    fn ph_convert_no_panic(s in "\\PC{0,30}", bs in proptest::collection::vec(bound_strat(), 0..6),
                           ps in proptest::collection::vec(pat_strat(), 0..4), d in "\\PC{0,3}") {
        let _ = Converter::new().set_boundaries(&bs).set_patterns(&ps).set_delimiter(d).convert(&s);
    }

    #[test]
    fn ph_idempotent_same_case(s in "[a-zA-Z0-9_ -]{0,20}", c in case_strat()) {
        let conv = Converter::new().from_case(c).to_case(c);
        let once = conv.convert(&s);
        prop_assert_eq!(conv.convert(&once), once.clone());
    }

    #[test]
    fn ph_empty_is_empty(c in case_strat()) {
        prop_assert_eq!(Converter::new().to_case(c).convert(""), "");
    }

    // delimiter-only boundary sets should agree whatever extra no-op boundaries are present
    #[test]
    fn ph_fast_vs_general_path(s in "[a-z_ -]{0,20}") {
        let fast = Converter::new().set_boundaries(&[Boundary::Underscore, Boundary::Hyphen, Boundary::Space]).convert(&s);
        let gen = Converter::new().set_boundaries(&[Boundary::Underscore, Boundary::Hyphen, Boundary::Space, Boundary::DigitLower]).convert(&s);
        prop_assert_eq!(fast, gen);
    }

    #[test]
    fn ph_fast_vs_general_unicode(s in "[a-z_ -]{0,6}\u{0301}?[a-z_ -]{0,6}") {
        let fast = Converter::new().set_boundaries(&[Boundary::Underscore]).convert(&s);
        let gen = Converter::new().set_boundaries(&[Boundary::Underscore, Boundary::DigitLower]).convert(&s);
        prop_assert_eq!(fast, gen);
    }
}
