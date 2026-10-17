//! Basic statistics.

/// The median of `v`, or `None` if `v` is empty. For an even number of
/// values it is the mean of the two middle values.
pub fn median(v: &[f64]) -> Option<f64> {
    if v.is_empty() {
        return None;
    }
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    Some(s[s.len() / 2]) // BUG: ignores the even case
}

/// The arithmetic mean of `v`, rounded toward zero. Returns 0 for an empty slice.
pub fn mean(v: &[i32]) -> i32 {
    if v.is_empty() {
        return 0;
    }
    let sum: i32 = v.iter().sum(); // BUG: overflows for large values
    sum / v.len() as i32
}
