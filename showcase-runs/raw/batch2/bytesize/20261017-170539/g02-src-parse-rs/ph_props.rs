use bytesize::Unit;
use proptest::prelude::*;

fn table() -> Vec<(&'static str, &'static str, Unit)> {
    vec![
        ("k", "kb", Unit::KiloByte), ("m", "mb", Unit::MegaByte), ("g", "gb", Unit::GigaByte),
        ("t", "tb", Unit::TeraByte), ("p", "pb", Unit::PetaByte), ("e", "eb", Unit::ExaByte),
        ("ki", "kib", Unit::KibiByte), ("mi", "mib", Unit::MebiByte), ("gi", "gib", Unit::GibiByte),
        ("ti", "tib", Unit::TebiByte), ("pi", "pib", Unit::PebiByte), ("ei", "eib", Unit::ExbiByte),
    ]
}

fn case(s: &str, mask: &[bool]) -> String {
    s.chars().enumerate().map(|(i, c)| if mask[i % mask.len()] { c.to_ascii_uppercase() } else { c }).collect()
}

proptest! {
    #[test]
    fn ph_known_units_any_case(idx in 0usize..12, long in any::<bool>(), mask in proptest::collection::vec(any::<bool>(), 1..4)) {
        let (a, b, u) = table()[idx].clone();
        let s = case(if long { b } else { a }, &mask);
        prop_assert_eq!(s.parse::<Unit>().unwrap(), u);
    }

    #[test]
    fn ph_byte(mask in proptest::collection::vec(any::<bool>(), 1..2)) {
        prop_assert_eq!(case("b", &mask).parse::<Unit>().unwrap(), Unit::Byte);
    }

    #[test]
    fn ph_never_panics(s in "\\PC{0,12}") {
        let r = s.parse::<Unit>();
        if let Err(e) = r { let _ = e.to_string(); }
    }

    #[test]
    fn ph_unknown_errors(s in "[a-zA-Z\u{80}-\u{10ffff}0-9 ]{0,8}") {
        let known = s.eq_ignore_ascii_case("b") || table().iter().any(|(a,b,_)| s.eq_ignore_ascii_case(a) || s.eq_ignore_ascii_case(b));
        prop_assert_eq!(s.parse::<Unit>().is_ok(), known);
    }
}
