use glob::{MatchOptions, Pattern};
use proptest::prelude::*;
use std::path::Path;

fn opts(cs: bool, sep: bool, dot: bool) -> MatchOptions {
    MatchOptions { case_sensitive: cs, require_literal_separator: sep, require_literal_leading_dot: dot }
}

// reference matcher for patterns made of literals, ?, *, [set] (no **), default options
fn refmatch(p: &[char], s: &[char]) -> bool {
    if p.is_empty() { return s.is_empty(); }
    match p[0] {
        '*' => (0..=s.len()).any(|k| refmatch(&p[1..], &s[k..])),
        '?' => !s.is_empty() && refmatch(&p[1..], &s[1..]),
        c => !s.is_empty() && s[0] == c && refmatch(&p[1..], &s[1..]),
    }
}

proptest! {
    #[test]
    fn ph_escape_matches_self(s in "\\PC{0,20}") {
        let e = Pattern::escape(&s);
        let p = Pattern::new(&e).unwrap();
        prop_assert!(p.matches(&s));
        prop_assert!(p.matches_path(Path::new(&s)));
    }

    #[test]
    fn ph_escape_only_self(s in "[a-c?*\\[\\]!\\-]{0,8}", t in "[a-c?*\\[\\]!\\-]{0,8}") {
        let p = Pattern::new(&Pattern::escape(&s)).unwrap();
        prop_assert_eq!(p.matches(&t), s == t);
    }

    #[test]
    fn ph_escape_opts(s in "[a-cA-C?*\\[\\]!\\-./]{0,8}", cs: bool, sep: bool) {
        let p = Pattern::new(&Pattern::escape(&s)).unwrap();
        prop_assert!(p.matches_with(&s, opts(cs, sep, false)));
        if cs {
            let t = format!("{}x", s);
            prop_assert!(!p.matches_with(&t, opts(cs, sep, false)));
        }
    }

    #[test]
    fn ph_ref_agree(pat in "[ab?*]{0,8}", s in "[ab]{0,8}") {
        prop_assume!(!pat.contains("**"));
        let p = Pattern::new(&pat).unwrap();
        let pc: Vec<char> = pat.chars().collect();
        let sc: Vec<char> = s.chars().collect();
        prop_assert_eq!(p.matches(&s), refmatch(&pc, &sc));
    }

    #[test]
    fn ph_from_str_eq_new(pat in "[ab?*\\[\\]!\\-/.]{0,10}") {
        let a = Pattern::new(&pat);
        let b = pat.parse::<Pattern>();
        prop_assert_eq!(a.is_ok(), b.is_ok());
        if let (Ok(a), Ok(b)) = (a, b) {
            prop_assert_eq!(&a, &b);
            prop_assert_eq!(a.as_str(), pat.as_str());
            prop_assert_eq!(a.to_string(), pat.clone());
        }
    }

    #[test]
    fn ph_path_agrees(pat in "[ab?*/.]{0,8}", s in "[ab/.]{0,8}", cs: bool, sep: bool, dot: bool) {
        prop_assume!(!pat.contains("**"));
        let p = Pattern::new(&pat).unwrap();
        prop_assert_eq!(p.matches(&s), p.matches_path(Path::new(&s)));
        let o = opts(cs, sep, dot);
        prop_assert_eq!(p.matches_with(&s, o), p.matches_path_with(Path::new(&s), o));
    }

    #[test]
    fn ph_no_panic(pat in "[ab?*\\[\\]!\\-/.]{0,12}", s in "[abAB/.\\-!]{0,10}", cs: bool, sep: bool, dot: bool) {
        if let Ok(p) = Pattern::new(&pat) {
            let _ = p.matches_with(&s, opts(cs, sep, dot));
        }
    }

    #[test]
    fn ph_literal_set(c in proptest::char::range('a','z'), x in proptest::char::range('a','z')) {
        let p = Pattern::new(&format!("[{}]", c)).unwrap();
        prop_assert_eq!(p.matches(&x.to_string()), c == x);
        let n = Pattern::new(&format!("[!{}]", c)).unwrap();
        prop_assert_eq!(n.matches(&x.to_string()), c != x);
    }

    #[test]
    fn ph_range(a in proptest::char::range('a','z'), b in proptest::char::range('a','z'), x in proptest::char::range('a','z')) {
        let p = Pattern::new(&format!("[{}-{}]", a, b)).unwrap();
        prop_assert_eq!(p.matches(&x.to_string()), a <= x && x <= b);
        let n = Pattern::new(&format!("[!{}-{}]", a, b)).unwrap();
        prop_assert_eq!(n.matches(&x.to_string()), !(a <= x && x <= b));
    }

    #[test]
    fn ph_case_insens(a in proptest::char::range('a','z'), b in proptest::char::range('a','z'), x in proptest::char::range('a','z'), up: bool) {
        let o = opts(false, false, false);
        let p = Pattern::new(&format!("[{}-{}]", a, b)).unwrap();
        let xs = if up { x.to_ascii_uppercase() } else { x }.to_string();
        prop_assert_eq!(p.matches_with(&xs, o), a <= x && x <= b);
        let q = Pattern::new(&format!("[{}-{}]", a.to_ascii_uppercase(), b.to_ascii_uppercase())).unwrap();
        prop_assert_eq!(q.matches_with(&xs, o), a <= x && x <= b);
    }

    #[test]
    fn ph_sep_dot(s in "[ab]{1,4}") {
        let o = opts(true, true, false);
        let p = Pattern::new("*").unwrap();
        let two = format!("{}/{}", s, s);
        let dotted = format!(".{}", s);
        prop_assert!(!p.matches_with(&two, o));
        prop_assert!(p.matches_with(&s, o));
        let o2 = opts(true, false, true);
        prop_assert!(!p.matches_with(&dotted, o2));
        let r = Pattern::new("**/*").unwrap();
        prop_assert!(r.matches(&two));
    }

    #[test]
    fn ph_glob_no_panic(pat in "[ab?*\\[\\]!\\-/.]{0,10}") {
        match glob::glob(&pat) { Ok(it) => { for _ in it.take(20) {} } Err(_) => {} }
    }
}
