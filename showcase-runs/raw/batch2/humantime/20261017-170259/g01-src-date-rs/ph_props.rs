use humantime::*;
use proptest::prelude::*;
use std::time::{Duration, UNIX_EPOCH};

proptest! {
    #[test]
    fn ph_roundtrip_nanos(s in 0u64..253_402_300_800, n in 0u32..1_000_000_000) {
        let t = UNIX_EPOCH + Duration::new(s, n);
        let f = format_rfc3339_nanos(t).to_string();
        prop_assert_eq!(f.len(), 30);
        prop_assert_eq!(parse_rfc3339(&f).unwrap(), t);
        let g = format_rfc3339(t).to_string();
        prop_assert_eq!(parse_rfc3339(&g).unwrap(), t);
    }
    #[test]
    fn ph_trunc(s in 0u64..253_402_300_800, n in 0u32..1_000_000_000) {
        let t = UNIX_EPOCH + Duration::new(s, n);
        let ms = parse_rfc3339(&format_rfc3339_millis(t).to_string()).unwrap();
        prop_assert_eq!(ms, UNIX_EPOCH + Duration::new(s, n / 1_000_000 * 1_000_000));
        let us = parse_rfc3339(&format_rfc3339_micros(t).to_string()).unwrap();
        prop_assert_eq!(us, UNIX_EPOCH + Duration::new(s, n / 1000 * 1000));
        let se = parse_rfc3339(&format_rfc3339_seconds(t).to_string()).unwrap();
        prop_assert_eq!(se, UNIX_EPOCH + Duration::new(s, 0));
    }
    #[test]
    fn ph_plus00(s in 0u64..253_402_300_800) {
        let t = UNIX_EPOCH + Duration::new(s, 0);
        let f = format_rfc3339(t).to_string();
        let p = format!("{}+00:00", &f[..19]);
        prop_assert_eq!(parse_rfc3339(&p).unwrap(), t);
    }
    #[test]
    fn ph_no_trailing_garbage(s in 0u64..253_402_300_800, g in "[A-Za-z0-9]{0,4}Z") {
        let t = UNIX_EPOCH + Duration::new(s, 0);
        let f = format_rfc3339(t).to_string();
        let bad = format!("{}{}", f, g);
        prop_assert!(parse_rfc3339(&bad).is_err(), "{}", bad);
    }
    #[test]
    fn ph_no_panic(s in "\\PC{0,40}") { let _ = parse_rfc3339(&s); }
}
