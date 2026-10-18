use proptest::prelude::*;
use shell_words::{join, quote, split};

proptest! {
    #[test]
    fn ph_quote_roundtrip(s in "\\PC{0,20}|[ -~\\n\\t\\r]{0,20}") {
        prop_assert_eq!(split(&quote(&s)).unwrap(), vec![s]);
    }
    #[test]
    fn ph_join_roundtrip(v in proptest::collection::vec("[ -~\\n\\t\\r\\u{80}-\\u{2000}]{0,8}", 0..6)) {
        prop_assert_eq!(split(&join(&v)).unwrap(), v);
    }
    #[test]
    fn ph_quote_plain_unchanged(s in "[a-zA-Z0-9_./:@,+-]{1,10}") {
        let q = quote(&s);
        prop_assert_eq!(q.as_ref(), s.as_str());
    }
    #[test]
    fn ph_split_no_panic(s in "[ -~\\n\\t\\\\'\"#]{0,20}") {
        let _ = split(&s);
    }
    #[test]
    fn ph_split_join_idempotent(s in "[a-z '\"\\\\#\\n]{0,15}") {
        if let Ok(v) = split(&s) {
            let j = join(&v);
            prop_assert_eq!(split(&j).unwrap(), v);
        }
    }
    #[test]
    fn ph_join_concat(a in proptest::collection::vec("[ -~]{0,5}",0..4), b in proptest::collection::vec("[ -~]{0,5}",1..4)) {
        let mut all = a.clone(); all.extend(b.clone());
        let ja = join(&a);
        let sep = if a.is_empty() {""} else {" "};
        prop_assert_eq!(join(&all), format!("{}{}{}", ja, sep, join(&b)));
    }
}
