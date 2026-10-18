use proptest::prelude::*;
use wildmatch::{WildMatch, WildMatchPattern};

fn reference(p: &[char], s: &[char], ci: bool) -> bool {
    let eq = |a: char, b: char| a == b || (ci && a.to_lowercase().collect::<Vec<_>>() == b.to_lowercase().collect::<Vec<_>>());
    let mut dp = vec![vec![false; s.len() + 1]; p.len() + 1];
    dp[0][0] = true;
    for i in 1..=p.len() {
        for j in 0..=s.len() {
            dp[i][j] = match p[i - 1] {
                '*' => dp[i - 1][j] || (j > 0 && dp[i][j - 1]),
                '?' => j > 0 && dp[i - 1][j - 1],
                c => j > 0 && dp[i - 1][j - 1] && eq(c, s[j - 1]),
            };
        }
    }
    dp[p.len()][s.len()]
}

proptest! {
    #[test]
    fn ph_matches_reference(p in "[ab*?]{0,10}", s in "[abAB]{0,10}") {
        let pc: Vec<char> = p.chars().collect(); let sc: Vec<char> = s.chars().collect();
        prop_assert_eq!(WildMatch::new(&p).matches(&s), reference(&pc, &sc, false));
    }
    #[test]
    fn ph_matches_reference_ci(p in "[aB*?]{0,10}", s in "[abAB]{0,10}") {
        let pc: Vec<char> = p.chars().collect(); let sc: Vec<char> = s.chars().collect();
        prop_assert_eq!(WildMatch::new_case_insensitive(&p).matches(&s), reference(&pc, &sc, true));
    }
    #[test]
    fn ph_unicode(p in "[aé*?İiß]{0,8}", s in "[aéİiIßS]{0,8}") {
        let pc: Vec<char> = p.chars().collect(); let sc: Vec<char> = s.chars().collect();
        prop_assert_eq!(WildMatch::new(&p).matches(&s), reference(&pc, &sc, false));
        prop_assert_eq!(WildMatch::new_case_insensitive(&p).matches(&s), reference(&pc, &sc, true));
    }
    #[test]
    fn ph_simplify(p in "[ab*?]{0,12}") {
        let w = WildMatch::new(&p);
        let mut exp = String::new();
        for c in p.chars() { if !(c=='*' && exp.ends_with('*')) { exp.push(c);} }
        prop_assert_eq!(w.pattern(), exp);
        prop_assert!(!w.is_case_insensitive());
        prop_assert!(WildMatch::new_case_insensitive(&p).is_case_insensitive());
    }
    #[test]
    fn ph_custom(p in "[ab%_]{0,10}", s in "[ab%_]{0,10}") {
        let m = WildMatchPattern::<'%', '_'>::new(&p);
        let pc: Vec<char> = p.chars().map(|c| match c {'%'=>'*','_'=>'?',x=>x}).collect();
        let sc: Vec<char> = s.chars().collect();
        prop_assert_eq!(m.matches(&s), reference(&pc, &sc, false));
        prop_assert_eq!(m == s.as_str(), m.matches(&s));
    }
    #[test]
    fn ph_self_match(p in "[ab]{0,10}") {
        prop_assert!(WildMatch::new(&p).matches(&p));
        prop_assert!(WildMatch::new("*").matches(&p));
    }
}
