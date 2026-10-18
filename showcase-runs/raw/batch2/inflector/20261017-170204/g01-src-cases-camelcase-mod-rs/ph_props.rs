use inflector::cases::camelcase::{to_camel_case, is_camel_case};
use proptest::prelude::*;

proptest! {
    #[test]
    fn ph_idempotent(s in "[a-zA-Z0-9 _-]{0,20}") {
        let a = to_camel_case(&s);
        prop_assert_eq!(to_camel_case(&a), a);
    }
    #[test]
    fn ph_is_camel_of_output(s in "[a-zA-Z0-9 _-]{0,20}") {
        prop_assert!(is_camel_case(&to_camel_case(&s)));
    }
    #[test]
    fn ph_idempotent_unicode(s in "\\PC{0,12}") {
        let a = to_camel_case(&s);
        prop_assert_eq!(to_camel_case(&a), a);
    }
    #[test]
    fn ph_no_separators(s in "[a-zA-Z0-9 _-]{0,20}") {
        prop_assert!(to_camel_case(&s).chars().all(|c| c.is_ascii_alphanumeric()));
    }
    #[test]
    fn ph_first_not_upper(s in "[a-zA-Z0-9 _-]{0,20}") {
        let a = to_camel_case(&s);
        prop_assert!(!a.chars().next().map_or(false, |c| c.is_uppercase()));
    }
    #[test]
    fn ph_alnum_preserved(s in "[a-zA-Z0-9 _-]{0,20}") {
        let a: String = to_camel_case(&s).to_lowercase();
        let b: String = s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase();
        prop_assert_eq!(a, b);
    }
}
