use heck::ToSnakeCase;
use proptest::prelude::*;

fn ok(c: char) -> bool {
    !c.is_uppercase() || c.to_lowercase().next() != Some(c)
}

proptest! {
    #[test]
    fn ph_idempotent_unicode_filtered(s in "\\PC{0,20}") {
        prop_assume!(s.chars().all(ok));
        let a = s.to_snake_case();
        prop_assert_eq!(a.to_snake_case(), a);
    }

    #[test]
    fn ph_idempotent_mixed(s in "[a-zA-Zσ Σİß1-9_ǅǆ]{0,12}") {
        prop_assume!(s.chars().all(ok));
        let a = s.to_snake_case();
        prop_assert_eq!(a.to_snake_case(), a);
    }

    #[test]
    fn ph_no_empty_words(s in "\\PC{0,20}") {
        let a = s.to_snake_case();
        prop_assert!(!a.starts_with('_') && !a.contains("__"));
    }
}
