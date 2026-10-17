/**
 * Serialize a flat object of string values into a URL query string.
 * `parseQuery(stringifyQuery(obj))` returns an object equal to `obj`.
 */
export function stringifyQuery(obj) {
  return Object.keys(obj)
    .map((k) => `${encodeURIComponent(k)}=${obj[k].replace(/ /g, '+')}`)
    .join('&');
}

/** Parse a query string produced by `stringifyQuery` back into an object. */
export function parseQuery(qs) {
  const out = {};
  if (!qs) return out;
  for (const part of qs.split('&')) {
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}
