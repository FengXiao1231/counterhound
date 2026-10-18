use bytesize::*;
use proptest::prelude::*;
proptest! {
    #[test] fn ph_b(n in any::<u64>()) { prop_assert_eq!(ByteSize::b(n).as_u64(), n); }
    #[test] fn ph_kb(n in 0u64..u64::MAX/1000) { prop_assert_eq!(ByteSize::kb(n).as_u64(), n*1000); prop_assert_eq!(ByteSize::kb(n).as_u64(), kb(n)); }
    #[test] fn ph_kib(n in 0u64..u64::MAX/1024) { prop_assert_eq!(ByteSize::kib(n).as_u64(), n*1024); prop_assert_eq!(ByteSize::kib(n).as_u64(), kib(n)); }
    #[test] fn ph_mb(n in 0u64..u64::MAX/1_000_000) { prop_assert_eq!(ByteSize::mb(n).as_u64(), n*1_000_000); prop_assert_eq!(ByteSize::mb(n), ByteSize::kb(n*1000)); }
    #[test] fn ph_mib(n in 0u64..u64::MAX/1_048_576) { prop_assert_eq!(ByteSize::mib(n).as_u64(), n<<20); prop_assert_eq!(ByteSize::mib(n), ByteSize::kib(n*1024)); }
    #[test] fn ph_gb(n in 0u64..u64::MAX/1_000_000_000) { prop_assert_eq!(ByteSize::gb(n).as_u64(), n*1_000_000_000); prop_assert_eq!(ByteSize::gb(n), ByteSize::mb(n*1000)); }
    #[test] fn ph_mono(a in 0u64..1<<30, b in 0u64..1<<30) { prop_assert_eq!(a<b, ByteSize::gb(a)<ByteSize::gb(b)); }
}
