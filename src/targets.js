// Ranking: which functions are most likely to have checkable properties (and real bugs)?

const STRONG = /(case|pretty|humani[sz]e|plural|singular|ordinal|ms$|bytes|size|camel|snake|kebab|title|parse|format|encode|decode|serial|deserial|dump|load|marshal|escape|unescape|quote|compress|decompress|convert|normali[sz]e|canonical|sort|merge|split|join|chunk|partition|tokeni[sz]e|slug|round|clamp|interval|range|diff|patch|inverse|invert|reverse|rotate|pack|unpack|to_?[A-Z_a-z]|from_?[A-Z_a-z]|wrap|truncate|pad|strip|trim|hash|checksum|base\d*|hex|url|path|semver|version|date|time|duration|median|mean|percent|ratio|scale|interp|lerp|bisect|search|union|intersect|dedup|unique|flatten|group|bucket|window|validate|render|template|quantile|histogram)/i;
const WEAK = /(get|set|init|setup|teardown|main|run|start|stop|close|open|connect|send|fetch|request|handle|log|print|show|register|save|write|read|delete|update|create|cli|command|app|view|route)/i;
const PAIRS = [
  ['encode', 'decode'], ['serialize', 'deserialize'], ['dump', 'load'], ['dumps', 'loads'], ['compress', 'decompress'],
  ['escape', 'unescape'], ['quote', 'unquote'], ['pack', 'unpack'], ['to_', 'from_'], ['marshal', 'unmarshal'],
  ['format', 'parse'], ['stringify', 'parse'], ['encrypt', 'decrypt'],
];

export function scoreTarget(t, siblings = []) {
  let s = 0;
  const why = [];
  if (STRONG.test(t.name)) { s += 3; why.push('name suggests a checkable transformation'); }
  if (WEAK.test(t.name) && !STRONG.test(t.name)) s -= 2;
  if (t.doc) { s += Math.min(3, 1 + t.doc.length / 200); why.push('documented'); }
  if (t.annotated) { s += 1; why.push('typed'); }
  if (t.entry) { s += 3; why.push('public entry point'); }
  if (t.nArgs === 0) s -= 3;
  else if (t.nArgs <= 3) s += 1;
  else if (t.nArgs > 5) s -= 1;
  if (t.loc < 3) s -= 2;
  else if (t.loc <= 80) s += 1.5;
  else if (t.loc > 200) s -= 1;
  if (t.impure && t.impure.length) { s -= 2 * Math.min(3, t.impure.length); why.push(`touches ${t.impure.slice(0, 3).join(', ')}`); }
  if (t.async) s -= 1;
  const lname = t.name.toLowerCase();
  for (const [a, b] of PAIRS) {
    const other = lname.includes(a) ? lname.replace(a, b) : lname.includes(b) ? lname.replace(b, a) : null;
    if (other && other !== lname && siblings.some((x) => x.name.toLowerCase() === other)) {
      s += 3; why.push('has an inverse function (round-trip property)');
      break;
    }
  }
  return { score: Math.round(s * 10) / 10, why };
}

/**
 * Rank functions and group them by module, so one hunt sees related functions together
 * (round-trip pairs, helpers that share invariants).
 */
export function planGroups(targets, { maxGroups = 8, perGroup = 6, minScore = 0, only } = {}) {
  let pool = targets;
  if (only && only.length) {
    pool = targets.filter((t) => only.some((o) => t.id === o || t.id.endsWith('.' + o) || t.name === o || t.file === o || t.file.startsWith(o.replace(/\/$/, '') + '/') || t.module === o));
  }
  const byFile = new Map();
  for (const t of pool) {
    if (!byFile.has(t.file)) byFile.set(t.file, []);
    byFile.get(t.file).push(t);
  }
  const groups = [];
  for (const [file, fns] of byFile) {
    for (const t of fns) Object.assign(t, scoreTarget(t, fns));
    const picked = fns.filter((t) => t.score > minScore || (only && only.length)).sort((a, b) => b.score - a.score).slice(0, perGroup);
    if (!picked.length) continue;
    const top = picked.slice(0, 3).reduce((a, t) => a + t.score, 0);
    groups.push({ file, module: picked[0].module, lang: picked[0].lang, functions: picked, score: Math.round(top * 10) / 10 });
  }
  groups.sort((a, b) => b.score - a.score);
  return groups.slice(0, maxGroups).map((g, i) => ({ ...g, id: `g${String(i + 1).padStart(2, '0')}-${g.file.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(-48)}` }));
}
