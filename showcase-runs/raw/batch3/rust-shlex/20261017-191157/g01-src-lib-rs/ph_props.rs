use proptest::prelude::*;
use shlex::{split, try_join, try_quote, Quoter};

fn s() -> impl Strategy<Value = String> {
    prop_oneof![
        "\\PC{0,12}".prop_map(|x| x.replace('\0', "")),
        "[ a-z'\"\\\\$`^!#~{},\\t\\n\\r\\u{7f}\\u{1}é€]{0,12}",
    ]
}
fn ws() -> impl Strategy<Value = Vec<String>> {
    proptest::collection::vec(s(), 0..6)
}

proptest! {
    #[test]
    fn ph_quote_roundtrip(x in s()) {
        let q = try_quote(&x).unwrap();
        prop_assert_eq!(split(&q), Some(vec![x.clone()]));
    }
    #[test]
    fn ph_join_roundtrip(w in ws()) {
        let j = try_join(w.iter().map(|x| x.as_str())).unwrap();
        prop_assert_eq!(split(&j), Some(w.clone()));
    }
    #[test]
    fn ph_join_matches_quotes(w in ws()) {
        let j = try_join(w.iter().map(|x| x.as_str())).unwrap();
        let r: Vec<String> = w.iter().map(|x| try_quote(x).unwrap().into_owned()).collect();
        prop_assert_eq!(j, r.join(" "));
    }
    #[test]
    fn ph_nul_error(a in s(), b in s(), allow in any::<bool>()) {
        let x = format!("{a}\0{b}");
        let q = Quoter::new().allow_nul(allow);
        if allow {
            let o = q.quote(&x).unwrap();
            prop_assert!(o.contains('\0'));
            prop_assert!(q.join(vec![x.as_str()]).is_ok());
            prop_assert_eq!(split(&o), Some(vec![x.clone()]));
        } else {
            prop_assert!(q.quote(&x).is_err());
            prop_assert!(try_quote(&x).is_err());
            prop_assert!(try_join(vec!["a", x.as_str()]).is_err());
        }
    }
    #[test]
    fn ph_nul_empty_ok(allow in any::<bool>()) {
        prop_assert_eq!(&*Quoter::new().allow_nul(allow).quote("").unwrap(), "''");
    }
    #[test]
    fn ph_safe_borrowed(x in "[a-zA-Z0-9+./:@_-]{1,20}") {
        let q = try_quote(&x).unwrap();
        prop_assert_eq!(&*q, x.as_str());
    }
    #[test]
    fn ph_split_no_panic(x in "\\PC{0,30}|[ a-z'\"\\\\#\\n\\t]{0,20}") {
        let _ = split(&x);
    }
    #[test]
    fn ph_split_ws(w in proptest::collection::vec("[a-z]{1,5}", 0..5), sp in "[ \\t\\n]{1,3}") {
        let inp = format!("{sp}{}{sp}", w.join(&sp));
        prop_assert_eq!(split(&inp), Some(w));
    }
    #[test]
    fn ph_quote_idempotent_nonspecial(x in s()) {
        let q = try_quote(&x).unwrap().into_owned();
        let y = split(&q).unwrap().pop().unwrap();
        prop_assert_eq!(try_quote(&y).unwrap().into_owned(), q);
    }
}
