use proptest::prelude::*;
use semver::{Comparator, Version, VersionReq};
use std::cmp::Ordering;

fn pre_id() -> impl Strategy<Value = String> {
    prop_oneof![
        "0|[1-9][0-9]{0,25}",
        "[0-9]*[A-Za-z-][0-9A-Za-z-]{0,6}",
    ]
}
fn pre() -> impl Strategy<Value = String> {
    proptest::collection::vec(pre_id(), 1..4).prop_map(|v| v.join("."))
}
fn build() -> impl Strategy<Value = String> {
    proptest::collection::vec("[0-9A-Za-z-]{1,6}", 1..4).prop_map(|v| v.join("."))
}
fn ver() -> impl Strategy<Value = (u64, u64, u64, Option<String>, Option<String>)> {
    (any::<u64>(), any::<u64>(), any::<u64>(), proptest::option::of(pre()), proptest::option::of(build()))
}
fn fmt(v: &(u64, u64, u64, Option<String>, Option<String>)) -> String {
    let mut s = format!("{}.{}.{}", v.0, v.1, v.2);
    if let Some(p) = &v.3 { s += "-"; s += p; }
    if let Some(b) = &v.4 { s += "+"; s += b; }
    s
}
fn ref_pre(a: &str, b: &str) -> Ordering {
    if a.is_empty() || b.is_empty() {
        return match (a.is_empty(), b.is_empty()) { (true, true) => Ordering::Equal, (true, false) => Ordering::Greater, _ => Ordering::Less };
    }
    let (x, y): (Vec<_>, Vec<_>) = (a.split('.').collect(), b.split('.').collect());
    for (i, j) in x.iter().zip(y.iter()) {
        let ni = i.bytes().all(|c| c.is_ascii_digit());
        let nj = j.bytes().all(|c| c.is_ascii_digit());
        let o = match (ni, nj) {
            (true, true) => i.len().cmp(&j.len()).then(i.cmp(j)),
            (true, false) => Ordering::Less,
            (false, true) => Ordering::Greater,
            _ => i.cmp(j),
        };
        if o != Ordering::Equal { return o; }
    }
    x.len().cmp(&y.len())
}

proptest! {
    #[test]
    fn ph_version_roundtrip(v in ver()) {
        let s = fmt(&v);
        let p = Version::parse(&s).unwrap();
        prop_assert_eq!(p.major, v.0); prop_assert_eq!(p.minor, v.1); prop_assert_eq!(p.patch, v.2);
        prop_assert_eq!(p.pre.as_str(), v.3.clone().unwrap_or_default());
        prop_assert_eq!(p.build.as_str(), v.4.clone().unwrap_or_default());
        prop_assert_eq!(p.to_string(), s);
    }
    #[test]
    fn ph_version_new(a in any::<u64>(), b in any::<u64>(), c in any::<u64>()) {
        let v = Version::new(a, b, c);
        let s = format!("{}.{}.{}", a, b, c);
        prop_assert_eq!(Version::parse(&s).unwrap(), v);
    }
    #[test]
    fn ph_parse_no_panic(s in "\\PC{0,30}") {
        let _ = Version::parse(&s); let _ = VersionReq::parse(&s); let _ = Comparator::parse(&s);
    }
    #[test]
    fn ph_parse_no_panic_ascii(s in "[0-9a-zA-Z.,+*^~<>= -]{0,40}") {
        let _ = Version::parse(&s);
        if let Ok(r) = VersionReq::parse(&s) {
            let t = r.to_string();
            let r2 = VersionReq::parse(&t).unwrap();
            prop_assert_eq!(r, r2);
        }
        if let Ok(c) = Comparator::parse(&s) {
            let t = c.to_string();
            prop_assert_eq!(Comparator::parse(&t).unwrap(), c);
        }
    }
    #[test]
    fn ph_version_parse_display_idem(s in "[0-9a-zA-Z.+-]{0,30}") {
        if let Ok(v) = Version::parse(&s) { prop_assert_eq!(v.to_string(), s); }
    }
    #[test]
    fn ph_cmp_precedence(a in ver(), b in ver()) {
        let (va, vb) = (Version::parse(&fmt(&a)).unwrap(), Version::parse(&fmt(&b)).unwrap());
        let exp = (a.0, a.1, a.2).cmp(&(b.0, b.1, b.2))
            .then(ref_pre(a.3.as_deref().unwrap_or(""), b.3.as_deref().unwrap_or("")));
        prop_assert_eq!(va.cmp_precedence(&vb), exp);
        prop_assert_eq!(vb.cmp_precedence(&va), exp.reverse());
        let mut vc = va.clone(); vc.build = semver::BuildMetadata::new("zz").unwrap();
        prop_assert_eq!(va.cmp_precedence(&vc), Ordering::Equal);
    }
    #[test]
    fn ph_ord_consistent(a in ver(), b in ver()) {
        let (va, vb) = (Version::parse(&fmt(&a)).unwrap(), Version::parse(&fmt(&b)).unwrap());
        prop_assert_eq!(va.cmp(&vb) == Ordering::Equal, va == vb);
        if va.cmp_precedence(&vb) != Ordering::Equal { prop_assert_eq!(va.cmp(&vb), va.cmp_precedence(&vb)); }
    }
    #[test]
    fn ph_matches_ref(op in prop_oneof![Just("="),Just(">"),Just(">="),Just("<"),Just("<="),Just("~"),Just("^"),Just("")],
        c in (0u64..4,0u64..4,0u64..4), v in (0u64..4,0u64..4,0u64..4)) {
        let req = VersionReq::parse(&format!("{}{}.{}.{}", op, c.0, c.1, c.2)).unwrap();
        let ver = Version::new(v.0, v.1, v.2);
        let exp = match op {
            "=" => v == c, ">" => v > c, ">=" => v >= c, "<" => v < c, "<=" => v <= c,
            "~" => v >= c && v.0 == c.0 && v.1 == c.1,
            _ => {
                let upper = if c.0 > 0 { (c.0+1,0,0) } else if c.1 > 0 { (0,c.1+1,0) } else { (0,0,c.2+1) };
                v >= c && v < upper
            }
        };
        prop_assert_eq!(req.matches(&ver), exp);
        let cs = format!("{}{}.{}.{}", op, c.0, c.1, c.2);
        prop_assert_eq!(Comparator::parse(&cs).unwrap().matches(&ver), exp);
    }
    #[test]
    fn ph_partial_matches(op in prop_oneof![Just("="),Just(">"),Just(">="),Just("<"),Just("<="),Just("~"),Just("^")],
        a in 0u64..3, b in proptest::option::of(0u64..3), v in (0u64..4,0u64..4,0u64..4)) {
        let s = match b { Some(b) => format!("{}{}.{}", op, a, b), None => format!("{}{}", op, a) };
        let req = VersionReq::parse(&s).unwrap();
        let ver = Version::new(v.0, v.1, v.2);
        let lo = (a, b.unwrap_or(0), 0u64);
        let hi_excl = match b { Some(b) => (a, b + 1, 0), None => (a + 1, 0, 0) };
        let caret_hi = if a > 0 || b.is_none() { (a+1,0,0) } else { let b=b.unwrap(); if b>0 {(0,b+1,0)} else {(0,1,0)} };
        let exp = match op {
            "=" => v >= lo && v < hi_excl,
            ">" => v >= hi_excl,
            ">=" => v >= lo,
            "<" => v < lo,
            "<=" => v < hi_excl,
            "~" => v >= lo && v < hi_excl,
            _ => v >= lo && v < caret_hi,
        };
        prop_assert_eq!(req.matches(&ver), exp, "{}", s);
    }
    #[test]
    fn ph_star_and_wild(v in (any::<u64>(),any::<u64>(),any::<u64>())) {
        let ver = Version::new(v.0, v.1, v.2);
        for s in ["*", "x", "X", " *", "* "] { assert!(VersionReq::parse(s).unwrap().matches(&ver)); }
        let s1 = format!("{}.*", v.0);
        let s2 = format!("{}.{}.*", v.0, v.1);
        let s3 = format!(">={}.{}.{}", v.0, v.1, v.2);
        let s4 = format!("={}.{}.{}", v.0, v.1, v.2);
        for s in [s1, s2, s3, s4] { assert!(VersionReq::parse(&s).unwrap().matches(&ver), "{}", s); }
    }
    #[test]
    fn ph_multi_comparators(n in 1usize..40) {
        let s = vec![">=0.0.0"; n].join(", ");
        let r = VersionReq::parse(&s);
        if n <= 32 { let r = r.unwrap(); prop_assert_eq!(r.comparators.len(), n); } else { prop_assert!(r.is_err()); }
    }
    #[test]
    fn ph_pre_matching(a in 0u64..3, b in 0u64..3, c in 0u64..3, p in pre()) {
        let v = Version::parse(&format!("{a}.{b}.{c}-{p}")).unwrap();
        prop_assert!(!VersionReq::parse("*").unwrap().matches(&v));
        let q1 = format!(">={a}.{b}.{c}");
        let q2 = format!("={a}.{b}.{c}-{p}");
        let q3 = format!(">={a}.{b}.{c}-{p}");
        prop_assert!(!VersionReq::parse(&q1).unwrap().matches(&v));
        prop_assert!(VersionReq::parse(&q2).unwrap().matches(&v));
        prop_assert!(VersionReq::parse(&q3).unwrap().matches(&v));
    }
}
