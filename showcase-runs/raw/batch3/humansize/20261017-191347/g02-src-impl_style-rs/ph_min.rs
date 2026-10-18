use humansize::{FormatSize, FormatSizeI, DECIMAL};

#[test]
fn min() {
    assert_eq!(1000u64.format_size(DECIMAL), "1 kB");
    assert_eq!((-1000i64).format_size_i(DECIMAL), "-1 kB");
}
