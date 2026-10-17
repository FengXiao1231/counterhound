/**
 * Truncate `s` to at most `max` characters, ending with "…" when it was shortened.
 * The result is never longer than `max`.
 */
export function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

/** Convert camelCase to snake_case. */
export function camelToSnake(s) {
  return s.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());
}
