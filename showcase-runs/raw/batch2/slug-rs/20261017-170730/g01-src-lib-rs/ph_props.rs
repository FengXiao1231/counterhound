use proptest::prelude::*;
use slug::slugify;

proptest! {
    #[test]
    fn ph_charset(s in "\\PC*") {
        let r = slugify(&s);
        prop_assert!(r.chars().all(|c| matches!(c, 'a'..='z'|'0'..='9'|'-')), "{:?}", r);
    }
    #[test]
    fn ph_dashes(s in "\\PC*") {
        let r = slugify(&s);
        prop_assert!(!r.contains("--") && !r.starts_with('-') && !r.ends_with('-'), "{:?}", r);
    }
    #[test]
    fn ph_idempotent(s in "\\PC*") {
        let r = slugify(&s);
        prop_assert_eq!(slugify(&r), r);
    }
    #[test]
    fn ph_ascii_ref(s in "[ -~\\n\\t]*") {
        let mut out = String::new();
        let mut pending = false;
        for c in s.chars() {
            if c.is_ascii_alphanumeric() {
                if pending && !out.is_empty() { out.push('-'); }
                pending = false;
                out.push(c.to_ascii_lowercase());
            } else { pending = true; }
        }
        prop_assert_eq!(slugify(&s), out);
    }
    #[test]
    fn ph_any_unicode(s in proptest::collection::vec(any::<char>(), 0..30)) {
        let s: String = s.into_iter().collect();
        let r = slugify(&s);
        prop_assert!(r.chars().all(|c| matches!(c, 'a'..='z'|'0'..='9'|'-')));
        prop_assert!(!r.contains("--") && !r.starts_with('-') && !r.ends_with('-'));
    }
}
