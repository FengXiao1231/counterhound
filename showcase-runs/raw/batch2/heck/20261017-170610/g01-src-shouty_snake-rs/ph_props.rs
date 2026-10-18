use heck::{ToShoutySnakeCase, ToShoutySnekCase};
use proptest::prelude::*;

proptest! {
    #[test]
    fn ph_alias_agrees(s in "\\PC*") {
        prop_assert_eq!(s.to_shouty_snake_case(), s.TO_SHOUTY_SNEK_CASE());
    }

    #[test]
    fn ph_no_stray_underscores(s in "\\PC*") {
        let o = s.to_shouty_snake_case();
        prop_assert!(!o.starts_with('_') && !o.ends_with('_') && !o.contains("__"), "{:?}", o);
    }

    #[test]
    fn ph_only_alnum_and_underscore(s in "\\PC*") {
        let o = s.to_shouty_snake_case();
        prop_assert!(o.chars().all(|c| c == '_' || c.is_alphanumeric()), "{:?}", o);
    }

    #[test]
    fn ph_idempotent(s in "\\PC*") {
        let o = s.to_shouty_snake_case();
        prop_assert_eq!(o.to_shouty_snake_case(), o);
    }

    #[test]
    fn ph_idempotent_ascii(s in "[a-zA-Z0-9_ -]*") {
        let o = s.to_shouty_snake_case();
        prop_assert_eq!(o.to_shouty_snake_case(), o);
    }

    #[test]
    fn ph_ascii_no_lowercase(s in "[a-zA-Z0-9_ -]*") {
        let o = s.to_shouty_snake_case();
        prop_assert!(!o.chars().any(|c| c.is_lowercase()));
    }

    #[test]
    fn ph_ascii_alnum_preserved(s in "[a-zA-Z0-9_ -]*") {
        let o = s.to_shouty_snake_case();
        let a: String = s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_uppercase();
        let b: String = o.chars().filter(|c| *c != '_').collect();
        prop_assert_eq!(a, b);
    }

    #[test]
    fn ph_separator_insensitive(s in "[a-zA-Z0-9]{0,6}( [a-zA-Z0-9]{1,6}){0,4}") {
        prop_assert_eq!(s.to_shouty_snake_case(), s.replace(' ', "_").to_shouty_snake_case());
        prop_assert_eq!(s.to_shouty_snake_case(), s.replace(' ', "-").to_shouty_snake_case());
    }
}
