use proptest::prelude::*;
use shlex::bytes::{Quoter, try_join, try_quote, split};
use std::borrow::Cow;

fn word() -> impl Strategy<Value = Vec<u8>> {
    proptest::collection::vec(prop_oneof![
        any::<u8>(),
        proptest::sample::select(b"^'\"\\$`! #~=%{},\r\n\t*?[]|&;<>()\x7f\x80\xa0".to_vec()),
    ], 0..16)
}
fn word_nonul() -> impl Strategy<Value = Vec<u8>> {
    word().prop_map(|w| w.into_iter().filter(|&b| b != 0).collect())
}

proptest! {
    #[test]
    fn ph_quote_roundtrip(w in word_nonul()) {
        let q = try_quote(&w).unwrap();
        prop_assert_eq!(split(&q), Some(vec![w.clone()]));
    }
    #[test]
    fn ph_quote_roundtrip_nul(w in word()) {
        let q = Quoter::new().allow_nul(true).quote(&w).unwrap();
        prop_assert_eq!(split(&q), Some(vec![w.clone()]));
    }
    #[test]
    fn ph_nul_rejected(w in word()) {
        let r = try_quote(&w);
        if w.contains(&0) && !w.is_empty() { prop_assert!(r.is_err()); } else { prop_assert!(r.is_ok()); }
        let r2 = Quoter::new().allow_nul(false).quote(&w);
        prop_assert_eq!(r.is_ok(), r2.is_ok());
    }
    #[test]
    fn ph_join_roundtrip(ws in proptest::collection::vec(word_nonul(), 0..6)) {
        let j = try_join(ws.iter().map(|v| &v[..])).unwrap();
        prop_assert_eq!(split(&j), Some(ws.clone()));
    }
    #[test]
    fn ph_join_matches_manual(ws in proptest::collection::vec(word_nonul(), 0..6)) {
        let j = try_join(ws.iter().map(|v| &v[..])).unwrap();
        let mut m = vec![];
        for (i, w) in ws.iter().enumerate() { if i>0 { m.push(b' '); } m.extend_from_slice(&try_quote(w).unwrap()); }
        prop_assert_eq!(j, m);
    }
    #[test]
    fn ph_join_nul_err(ws in proptest::collection::vec(word(), 0..6)) {
        let r = try_join(ws.iter().map(|v| &v[..]));
        prop_assert_eq!(r.is_err(), ws.iter().any(|w| !w.is_empty() && w.contains(&0)));
    }
    #[test]
    fn ph_borrowed_iff_unchanged(w in word_nonul()) {
        let q = try_quote(&w).unwrap();
        if let Cow::Borrowed(b) = &q { prop_assert_eq!(*b, &w[..]); }
        if !w.is_empty() && q[..] == w[..] { prop_assert!(matches!(q, Cow::Borrowed(_))); }
    }
    #[test]
    fn ph_utf8_preserved(s in "\\PC{0,12}") {
        let q = try_quote(s.as_bytes()).unwrap();
        prop_assert!(std::str::from_utf8(&q).is_ok());
    }
    #[test]
    fn ph_no_bare_specials(w in word_nonul()) {
        let q = try_quote(&w).unwrap();
        if let Cow::Borrowed(_) = q {
            prop_assert!(w.iter().all(|b| b.is_ascii_alphanumeric() || b"+-./:@]_".contains(b)));
        }
    }
    #[test]
    fn ph_split_no_panic(w in proptest::collection::vec(any::<u8>(), 0..30)) {
        let _ = split(&w);
    }
    #[test]
    fn ph_no_caret_after_quote_start(w in word_nonul()) {
        let q = try_quote(&w).unwrap();
        for i in 0..q.len() { if q[i]==b'^' { prop_assert!(i>0 && q[i-1]==b'\'' ); } }
    }
}
