use heck::{ToSnakeCase, ToSnekCase};
use proptest::prelude::*;

proptest! {
    #[test]
    fn ph_snek_eq_snake(s in "\\PC{0,30}") {
        prop_assert_eq!(s.to_snek_case(), s.to_snake_case());
    }

    #[test]
    fn ph_idempotent_ascii(s in "[a-zA-Z0-9 _-]{0,20}") {
        let a = s.to_snake_case();
        prop_assert_eq!(a.to_snake_case(), a);
    }

    #[test]
    fn ph_idempotent_unicode(s in "\\PC{0,20}") {
        let a = s.to_snake_case();
        prop_assert_eq!(a.to_snake_case(), a);
    }

    #[test]
    fn ph_no_bad_underscores(s in "\\PC{0,30}") {
        let a = s.to_snake_case();
        prop_assert!(!a.starts_with('_') && !a.ends_with('_') && !a.contains("__"), "{:?}", a);
    }

    #[test]
    fn ph_no_uppercase_ascii(s in "[a-zA-Z0-9 _-]{0,30}") {
        let a = s.to_snake_case();
        prop_assert!(a.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'));
    }

    #[test]
    fn ph_alnum_preserved_ascii(s in "[a-zA-Z0-9 _-]{0,30}") {
        let a: String = s.to_snake_case().chars().filter(|c| *c != '_').collect();
        let b: String = s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase();
        prop_assert_eq!(a, b);
    }

    #[test]
    fn ph_separator_invariant(s in "[a-zA-Z0-9]{0,15}") {
        prop_assert_eq!(s.to_snake_case(), s.replace("", "").to_snake_case());
        let sp = format!(" {} ", s);
        prop_assert_eq!(sp.to_snake_case(), s.to_snake_case());
    }
}
