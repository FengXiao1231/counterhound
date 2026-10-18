use convert_case::{Boundary, Case, Casing};

#[test]
fn repro_fast_vs_general_path() {
    let s = " \u{301}"; // space + combining acute: one grapheme cluster
    // LowerUpper can never match in this string, so it must not change the result.
    let only_space = s.set_boundaries(&[Boundary::Space]).to_case(Case::Snake);
    let with_extra = s
        .set_boundaries(&[Boundary::Space, Boundary::LowerUpper])
        .to_case(Case::Snake);
    assert_eq!(only_space, with_extra);
}
