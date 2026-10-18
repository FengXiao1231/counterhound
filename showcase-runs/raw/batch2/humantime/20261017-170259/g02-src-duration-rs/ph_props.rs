use humantime::{format_duration, parse_duration};
use proptest::prelude::*;
use std::time::Duration;

proptest! {
    #[test]
    fn ph_round_trip(s in any::<u64>(), n in 0u32..1_000_000_000) {
        let d = Duration::new(s, n);
        let t = format_duration(d).to_string();
        prop_assert_eq!(parse_duration(&t), Ok(d), "text {}", t);
    }
    #[test]
    fn ph_sum(a in 0u64..1_000_000, b in 0u64..1_000_000, c in 0u64..1_000_000) {
        let t = format!("{}h {}m {}s", a, b, c);
        prop_assert_eq!(parse_duration(&t), Ok(Duration::from_secs(a*3600+b*60+c)));
        let t = format!("{}h{}m{}s", a, b, c);
        prop_assert_eq!(parse_duration(&t), Ok(Duration::from_secs(a*3600+b*60+c)));
    }
    #[test]
    fn ph_frac(a in 0u64..1000, f in 0u64..1000, ) {
        let t = format!("{}.{:03}s", a, f);
        prop_assert_eq!(parse_duration(&t), Ok(Duration::new(a, (f*1_000_000) as u32)));
        let t = format!("{}.{:03}ms", a, f);
        prop_assert_eq!(parse_duration(&t), Ok(Duration::new(0, (a*1_000_000+f*1000) as u32)));
    }
    #[test]
    fn ph_no_panic(s in "\\PC{0,20}") { let _ = parse_duration(&s); }
    #[test]
    fn ph_ws_in_number(a in 1u64..1000, b in 0u64..1000) {
        // digits separated by whitespace must not merge into one number
        let t = format!("{} {}s", a, b);
        prop_assert!(parse_duration(&t).is_err(), "{:?}", parse_duration(&t));
    }
}
