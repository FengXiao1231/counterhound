<!-- proofhound-report -->
### proofhound found 1 provable bug (1 with a verified fix)

Checked 8 functions in 2 modules with property-based tests. 1 reported → 1 reproduced → 1 unique → 1 confirmed by an independent review.

<details><summary><b>PH-001</b> Singular unit not chosen for negative sizes with magnitude 1.x (-1 formats as "-1 Bytes") <sub>(wrong result, src/impl_style.rs)</sub></summary>

| | |
|---|---|
| Function | `humansize::ISizeFormatter::fmt (the body behind FormatSizeI::format_size_i; the impl_style feature is not enabled in the` |
| Input | (-1i64).format_size_i(DECIMAL.long_units(true).space_after_value(true)), i.e. ISizeFormatter::new(-1i64, opts) |
| Expected | "-1 Byte" (singular, like "1 Byte") |
| Actual | "-1 Bytes" |
| Review | low severity, confidence 0.72 |

The code comment says the "s" is removed when the size is 1.x, and the rest of ISizeFormatter works on magnitude (fabs for scale selection and integer-part rendering). The plural check `f64_eq(ipart, 1.0)` uses the signed `modf` integer part, so it never fires for negative values. The result is that 1 gives "1 Byte" and -1 gives "-1 Bytes", which is an unintended asymmetry. The fix is a one-line `fabs(ipart)`, and no test or doc requires "-1 Bytes". The only doubt is that "-1 bytes" is arguably acceptable English, and the effect is limited to long units and bit-scale 0 with negative inputs.

Failing test (`repro_negative_one_plural.rs`, failed 3/3 runs):

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

Suggested fix (the repro passes with it; project tests passed (cargo test --quiet --color never)):

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
</details>

<sub>1m48s · $0.49 of model usage · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>
