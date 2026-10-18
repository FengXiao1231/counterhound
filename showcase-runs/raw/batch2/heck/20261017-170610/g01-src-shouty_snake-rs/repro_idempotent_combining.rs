use heck::ToShoutySnakeCase;

#[test]
fn repro_idempotent_combining() {
    let once = "ΐ".to_shouty_snake_case();
    let twice = once.to_shouty_snake_case();
    assert_eq!(once, twice);
}
