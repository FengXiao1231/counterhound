use humantime::parse_rfc3339;

#[test]
fn repro_trailing_garbage() {
    assert!(parse_rfc3339("1970-01-01T00:00:00ZZ").is_err());
    assert!(parse_rfc3339("1970-01-01T00:00:00Zabc+00:00").is_err());
}
