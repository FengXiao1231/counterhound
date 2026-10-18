use heck::ToSnakeCase;

#[test]
fn repro_idempotent_dotted_i() {
    let once = "İ".to_snake_case();
    assert_eq!(once, "i\u{307}");
    // Re-applying to an already snake_case string must not change it.
    assert_eq!(once.to_snake_case(), once);
}
