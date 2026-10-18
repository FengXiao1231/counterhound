// FormatSizeI::format_size_i is exactly format!("{}", ISizeFormatter::new(v, opts));
// the `impl_style` feature is not enabled in the test harness, so call that directly.
use humansize::{ISizeFormatter, DECIMAL};

#[test]
fn repro_negative_one_plural() {
    let o = DECIMAL.long_units(true).space_after_value(true);
    assert_eq!(format!("{}", ISizeFormatter::new(1i64, o)), "1 Byte");
    assert_eq!(format!("{}", ISizeFormatter::new(-1i64, o)), "-1 Byte");
}
