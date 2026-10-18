use proptest::prelude::*;
use textwrap::core::{Fragment, Word};
use textwrap::wrap_algorithms::{wrap_first_fit, WrapAlgorithm};

#[derive(Debug, Clone, PartialEq)]
struct F(f64, f64, f64);
impl Fragment for F {
    fn width(&self) -> f64 { self.0 }
    fn whitespace_width(&self) -> f64 { self.1 }
    fn penalty_width(&self) -> f64 { self.2 }
}

fn frag() -> impl Strategy<Value = F> {
    (0u32..20, 0u32..5, 0u32..5).prop_map(|(a, b, c)| F(a as f64, b as f64, c as f64))
}

fn reference(fr: &[F], lw: &[f64]) -> Vec<Vec<F>> {
    let dflt = lw.last().copied().unwrap_or(0.0);
    let mut lines: Vec<Vec<F>> = vec![vec![]];
    let mut width = 0.0;
    for f in fr {
        let w = lw.get(lines.len() - 1).copied().unwrap_or(dflt);
        if width + f.0 + f.2 > w && !lines.last().unwrap().is_empty() {
            lines.push(vec![]);
            width = 0.0;
        }
        width += f.0 + f.1;
        lines.last_mut().unwrap().push(f.clone());
    }
    lines
}

proptest! {
    #[test]
    fn ph_first_fit_matches_reference(fr in proptest::collection::vec(frag(), 0..30),
                                      lw in proptest::collection::vec(0u32..40, 0..5)) {
        let lw: Vec<f64> = lw.into_iter().map(|x| x as f64).collect();
        let got = wrap_first_fit(&fr, &lw);
        let want = reference(&fr, &lw);
        let got: Vec<Vec<F>> = got.iter().map(|l| l.to_vec()).collect();
        prop_assert_eq!(got, want);
    }

    #[test]
    fn ph_first_fit_concat_and_nonempty(fr in proptest::collection::vec(frag(), 1..30),
                                        lw in proptest::collection::vec(1u32..40, 1..5)) {
        let lw: Vec<f64> = lw.into_iter().map(|x| x as f64).collect();
        let got = wrap_first_fit(&fr, &lw);
        let flat: Vec<F> = got.iter().flat_map(|l| l.iter().cloned()).collect();
        prop_assert_eq!(&flat, &fr);
        for l in &got { prop_assert!(!l.is_empty()); }
    }

    #[test]
    fn ph_first_fit_empty(lw in proptest::collection::vec(0u32..40, 0..5)) {
        let lw: Vec<f64> = lw.into_iter().map(|x| x as f64).collect();
        let fr: Vec<F> = vec![];
        let got = wrap_first_fit(&fr, &lw);
        prop_assert_eq!(got.len(), 1);
        prop_assert!(got[0].is_empty());
    }

    #[test]
    fn ph_first_fit_lines_fit(fr in proptest::collection::vec(frag(), 1..30),
                              lw in proptest::collection::vec(1u32..40, 1..5)) {
        let lw: Vec<f64> = lw.into_iter().map(|x| x as f64).collect();
        let got = wrap_first_fit(&fr, &lw);
        for (i, l) in got.iter().enumerate() {
            if l.len() > 1 {
                let w = lw.get(i).copied().unwrap_or(*lw.last().unwrap());
                let mut tot = 0.0;
                for (j, f) in l.iter().enumerate() {
                    tot += f.0;
                    if j + 1 < l.len() { tot += f.1 } else { tot += f.2 }
                }
                prop_assert!(tot <= w, "line {} width {} > {}", i, tot, w);
            }
        }
    }

    #[test]
    fn ph_wrap_algorithms_preserve_words(ws in proptest::collection::vec("[a-z]{1,10}", 0..20),
                                         lw in proptest::collection::vec(1usize..30, 1..4)) {
        let words: Vec<Word> = ws.iter().map(|s| Word::from(s.as_str())).collect();
        let mut algs = vec![WrapAlgorithm::FirstFit, WrapAlgorithm::new(), WrapAlgorithm::new_optimal_fit()];
        algs.push(WrapAlgorithm::default());
        for a in algs {
            let lines = a.wrap(&words, &lw);
            let flat: Vec<&str> = lines.iter().flat_map(|l| l.iter().map(|w| w.word)).collect();
            let orig: Vec<&str> = ws.iter().map(|s| s.as_str()).collect();
            prop_assert_eq!(flat, orig);
            for l in &lines { prop_assert!(!l.is_empty() || words.is_empty()); }
        }
    }

    #[test]
    fn ph_optimal_fit_huge_widths(ws in proptest::collection::vec("[a-z]{1,60}", 0..12),
                                  lw in proptest::collection::vec(prop_oneof![Just(0usize), Just(usize::MAX), 0usize..100, (usize::MAX-1000)..usize::MAX], 1..4)) {
        let words: Vec<Word> = ws.iter().map(|s| Word::from(s.as_str())).collect();
        let a = WrapAlgorithm::new_optimal_fit().wrap(&words, &lw);
        let b = WrapAlgorithm::FirstFit.wrap(&words, &lw);
        prop_assert_eq!(a.concat().len(), words.len());
        prop_assert_eq!(b.concat().len(), words.len());
    }

    #[test]
    fn ph_eq_laws(_x in 0..1) {
        prop_assert!(WrapAlgorithm::new_optimal_fit() == WrapAlgorithm::new_optimal_fit());
        prop_assert!(WrapAlgorithm::FirstFit != WrapAlgorithm::new_optimal_fit());
        prop_assert!(WrapAlgorithm::new() == WrapAlgorithm::default());
    }

    #[test]
    fn ph_wrap_empty_widths_no_panic(ws in proptest::collection::vec("[a-z]{1,10}", 0..10)) {
        let words: Vec<Word> = ws.iter().map(|s| Word::from(s.as_str())).collect();
        let _ = WrapAlgorithm::FirstFit.wrap(&words, &[]);
        let _ = WrapAlgorithm::new_optimal_fit().wrap(&words, &[]);
    }
}
