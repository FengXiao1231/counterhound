//! Small text and slice helpers.
//!
//! This is a counterhound test fixture: several functions contain planted bugs.

pub mod stats;

/// Splits `v` into consecutive chunks of length `n`. The last chunk may be
/// shorter. Concatenating the chunks gives back `v`.
///
/// # Panics
/// Panics if `n` is zero.
pub fn chunk(v: &[i32], n: usize) -> Vec<Vec<i32>> {
    assert!(n > 0, "chunk size must be positive");
    let mut out = Vec::new();
    let mut i = 0;
    while i + n <= v.len() {
        // BUG: drops the final partial chunk
        out.push(v[i..i + n].to_vec());
        i += n;
    }
    out
}

/// Returns at most `n` characters of `s`, never splitting a character.
pub fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n {
        return s.to_string();
    }
    s[..n].to_string() // BUG: byte index, panics inside a multi-byte character
}

/// Run-length encodes `s` as count+char pairs, e.g. "aaab" -> "3a1b".
/// `s` must consist of ASCII letters. [`rle_decode`] is its inverse.
pub fn rle_encode(s: &str) -> String {
    let mut out = String::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let mut j = i;
        while j < chars.len() && chars[j] == chars[i] {
            j += 1;
        }
        out.push_str(&(j - i).to_string());
        out.push(chars[i]);
        i = j;
    }
    out
}

/// Decodes the output of [`rle_encode`].
pub fn rle_decode(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i + 1 < chars.len() {
        // BUG: assumes single-digit counts
        let n = chars[i].to_digit(10).unwrap_or(0) as usize;
        out.extend(std::iter::repeat(chars[i + 1]).take(n));
        i += 2;
    }
    out
}

/// Error returned by [`parse_percent`].
#[derive(Debug, PartialEq)]
pub struct ParseError;

/// Parses a percentage between 0 and 100 inclusive, such as "42" or "42%".
/// Returns `Err(ParseError)` for anything else; that is intended.
pub fn parse_percent(s: &str) -> Result<u8, ParseError> {
    let t = s.strip_suffix('%').unwrap_or(s);
    match t.parse::<u8>() {
        Ok(v) if v <= 100 => Ok(v),
        _ => Err(ParseError),
    }
}
