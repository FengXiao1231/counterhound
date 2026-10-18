use proptest::prelude::*;
use textwrap::core::display_width;
use textwrap::{fill, refill, wrap, LineEnding, Options, WordSeparator, WordSplitter, WrapAlgorithm};

fn text() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9 \\-.,é世]{0,60}"
}
fn splitter() -> impl Strategy<Value = WordSplitter> {
    prop_oneof![
        Just(WordSplitter::HyphenSplitter),
        Just(WordSplitter::NoHyphenation)
    ]
}
fn sep() -> impl Strategy<Value = WordSeparator> {
    prop_oneof![
        Just(WordSeparator::AsciiSpace),
        Just(WordSeparator::UnicodeBreakProperties)
    ]
}
fn alg() -> impl Strategy<Value = WrapAlgorithm> {
    prop_oneof![
        Just(WrapAlgorithm::FirstFit),
        Just(WrapAlgorithm::new_optimal_fit())
    ]
}
fn le() -> impl Strategy<Value = LineEnding> {
    prop_oneof![Just(LineEnding::LF), Just(LineEnding::CRLF)]
}

proptest! {
    #[test]
    fn ph_builders_only_change_own_field(w in 0usize..200, si in "[ -]{0,4}", s in splitter(), sp in sep(), a in alg(), l in le()) {
        let base = Options::new(w).initial_indent("ab").break_words(false).preserve_trailing_space(true);
        let o = base.clone().subsequent_indent(&si);
        prop_assert_eq!(o.subsequent_indent, si.as_str());
        prop_assert_eq!(o.initial_indent, "ab");
        prop_assert_eq!(o.width, w);
        let o = base.clone().word_splitter(s.clone());
        prop_assert_eq!(&o.word_splitter, &s);
        prop_assert!(!o.break_words && o.preserve_trailing_space && o.width == w);
        let o = base.clone().word_separator(sp);
        prop_assert_eq!(o.word_separator, sp);
        prop_assert_eq!(o.initial_indent, "ab");
        let o = base.clone().wrap_algorithm(a);
        prop_assert_eq!(o.wrap_algorithm, a);
        prop_assert_eq!(o.width, w);
        let o = base.clone().line_ending(l);
        prop_assert_eq!(o.line_ending, l);
        prop_assert_eq!(o.subsequent_indent, "");
    }

    #[test]
    fn ph_new_defaults(w in 0usize..1000) {
        let o = Options::new(w);
        prop_assert_eq!(o.width, w);
        prop_assert_eq!(o.line_ending, LineEnding::LF);
        prop_assert!(o.break_words && !o.preserve_trailing_space);
        prop_assert_eq!(o.initial_indent, "");
        let o2: Options = w.into();
        prop_assert_eq!(o2.width, w);
    }

    #[test]
    fn ph_lines_fit(t in text(), w in 5usize..30, si in "[ ]{0,2}", s in splitter(), sp in sep(), a in alg()) {
        let o = Options::new(w).subsequent_indent(&si).word_splitter(s).word_separator(sp).wrap_algorithm(a);
        for line in wrap(&t, &o).iter() {
            let lw = display_width(line);
            prop_assert!(lw <= w, "line {:?} width {} > {}", line, lw, w);
        }
    }

    #[test]
    fn ph_content_preserved(t in text(), w in 1usize..30, s in splitter(), sp in sep(), a in alg()) {
        let o = Options::new(w).word_splitter(s).word_separator(sp).wrap_algorithm(a);
        let out: String = wrap(&t, &o).concat().chars().filter(|c| !c.is_whitespace()).collect();
        let inp: String = t.chars().filter(|c| !c.is_whitespace()).collect();
        prop_assert_eq!(out, inp);
    }

    #[test]
    fn ph_line_ending_fill(t in text(), w in 3usize..30) {
        let lf = fill(&t, Options::new(w));
        let crlf = fill(&t, Options::new(w).line_ending(LineEnding::CRLF));
        prop_assert_eq!(lf.replace('\n', "\r\n"), crlf);
        let r = refill(&t, Options::new(w).line_ending(LineEnding::CRLF));
        prop_assert!(!r.replace("\r\n", "").contains('\n'));
    }

    #[test]
    fn ph_indent_applied(t in "[a-z]{1,6}( [a-z]{1,6}){0,10}", w in 8usize..30, si in "[ ]{0,3}") {
        let o = Options::new(w).initial_indent("> ").subsequent_indent(&si);
        let lines = wrap(&t, &o);
        prop_assert!(lines[0].starts_with("> "));
        for l in &lines[1..] { prop_assert!(l.starts_with(si.as_str())); }
    }
}
