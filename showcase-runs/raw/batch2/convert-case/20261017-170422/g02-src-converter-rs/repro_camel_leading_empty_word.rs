use convert_case::{Case, Converter};

#[test]
fn repro_camel_leading_empty_word() {
    let conv = Converter::new().from_case(Case::Kebab).to_case(Case::Camel);
    // Pattern::Camel: "Makes the first non-empty word lowercase and the remaining capitalized."
    assert_eq!(conv.convert("-a-a"), "aA");
}
