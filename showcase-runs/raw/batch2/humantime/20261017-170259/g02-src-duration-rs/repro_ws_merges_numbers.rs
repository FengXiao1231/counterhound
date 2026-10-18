use humantime::parse_duration;

#[test]
fn repro_ws_merges_numbers() {
    // "1 30m": the first number has no unit; should be an error, not 130 minutes
    assert!(parse_duration("1 30m").is_err(), "{:?}", parse_duration("1 30m"));
}
