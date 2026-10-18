# Singular unit not chosen for negative sizes with magnitude 1.x (-1 formats as "-1 Bytes")

| | |
|---|---|
| Function | `humansize::ISizeFormatter::fmt (the body behind FormatSizeI::format_size_i; the impl_style feature is not enabled in the harness so the wrapper itself could not be called)` in `src/impl_style.rs` |
| Kind | Wrong result |
| Review | confirmed, confidence 0.72, severity low |
| Reproduced | 3/3 runs, same failure each time |

## What goes wrong

**Input:** (-1i64).format_size_i(DECIMAL.long_units(true).space_after_value(true)), i.e. ISizeFormatter::new(-1i64, opts)

**Expected:** "-1 Byte" (singular, like "1 Byte")

**Actual:** "-1 Bytes"

## Reproduce

```rust
// FormatSizeI::format_size_i is exactly format!("{}", ISizeFormatter::new(v, opts));
// the `impl_style` feature is not enabled in the test harness, so call that directly.
use humansize::{ISizeFormatter, DECIMAL};

#[test]
fn repro_negative_one_plural() {
    let o = DECIMAL.long_units(true).space_after_value(true);
    assert_eq!(format!("{}", ISizeFormatter::new(1i64, o)), "1 Byte");
    assert_eq!(format!("{}", ISizeFormatter::new(-1i64, o)), "-1 Byte");
}
```

Fails with `AssertionError: assertion `left == right` failed`

Copy it into `tests/repro_negative_one_plural.rs` and run `cargo test --test repro_negative_one_plural`.

## Suggested fix

The repro passes with this patch; the project's tests passed (cargo test --quiet --color never). Apply it with `git apply fix.patch`.

```diff
diff --git a/src/formatters.rs b/src/formatters.rs
index 09619aa..3d75bee 100644
--- a/src/formatters.rs
+++ b/src/formatters.rs
@@ -50,7 +50,7 @@ impl<T: ToF64, O: AsRef<FormatSizeOptions>> core::fmt::Display for ISizeFormatte
 
         // Remove "s" from the scale if the size is 1.x
         let (fpart, ipart) = modf(size);
-        if f64_eq(ipart, 1.0)
+        if f64_eq(fabs(ipart), 1.0)
             && (opts.long_units || (opts.base_unit == BaseUnit::Bit && scale_idx == 0))
         {
             scale = &scale[0..scale.len() - 1];
```

## Why this is a bug

formatters.rs says 'Remove "s" from the scale if the size is 1.x' but the check f64_eq(ipart, 1.0) uses the signed integer part, so it never fires for -1.x. Same for -1 kB-scale values, e.g. -1000 long decimal gives "-1 Kilobytes" vs "1 Kilobyte". Negation symmetry is the natural contract of format_size_i, whose docs show 1_000_000 -> "1 MB" and -1_000_000 -> "-1 MB".

Independent review: The code comment says the "s" is removed when the size is 1.x, and the rest of ISizeFormatter works on magnitude (fabs for scale selection and integer-part rendering). The plural check `f64_eq(ipart, 1.0)` uses the signed `modf` integer part, so it never fires for negative values. The result is that 1 gives "1 Byte" and -1 gives "-1 Bytes", which is an unintended asymmetry. The fix is a one-line `fabs(ipart)`, and no test or doc requires "-1 Bytes". The only doubt is that "-1 bytes" is arguably acceptable English, and the effect is limited to long units and bit-scale 0 with negative inputs.

## How it was found

Property: *formatting -v is the same as formatting v with a leading '-' (singular/plural unit choice depends only on magnitude)*.

proptest shrank the failure to: `Failing test case: v = -1`

---
Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed 3/3 times → independent review.
