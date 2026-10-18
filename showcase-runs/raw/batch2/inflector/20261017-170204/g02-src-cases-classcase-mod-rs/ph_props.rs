use inflector::cases::classcase::{is_class_case, to_class_case};
use proptest::prelude::*;

proptest! {
    #[test]
    fn ph_no_panic(s in "\\PC{0,20}") {
        let _ = to_class_case(&s);
        let _ = is_class_case(&s);
    }

    #[test]
    fn ph_idempotent(s in "[a-zA-Z0-9 _-]{0,20}") {
        let once = to_class_case(&s);
        prop_assert_eq!(to_class_case(&once), once);
    }

    #[test]
    fn ph_result_is_class_case(s in "[a-zA-Z0-9 _-]{0,20}") {
        prop_assert!(is_class_case(&to_class_case(&s)));
    }

    #[test]
    fn ph_no_separators(s in "[a-zA-Z0-9 _-]{0,20}") {
        let r = to_class_case(&s);
        prop_assert!(r.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn ph_first_upper(s in "[a-zA-Z _-]{1,20}") {
        let r = to_class_case(&s);
        if let Some(c) = r.chars().next() { prop_assert!(!c.is_lowercase()); }
    }

    #[test]
    fn ph_simple_words(a in "[a-z]{2,8}", b in "[a-z]{2,8}") {
        let r = to_class_case(&format!("{}_{}", a, b));
        prop_assert!(r.starts_with(&(a[..1].to_uppercase() + &a[1..])));
    }
}
