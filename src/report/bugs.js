import fs from 'node:fs';
import path from 'node:path';
import { slug, writeFile } from '../util.js';

const KIND = {
  crash: 'Crash on valid input',
  'internal-assert': 'Internal assertion fails',
  assertion: 'Wrong result',
};

/** Rewrite relative import paths so a copied JS repro still resolves from its new folder. */
export function relocateImports(source, fromDir, toDir) {
  return source.replace(/(from\s+|import\s*\(\s*|require\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (m, pre, q, spec) => {
    let rel = path.relative(toDir, path.resolve(fromDir, spec)).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return `${pre}${q}${rel}${q}`;
  });
}

export const FENCE = { python: 'python', javascript: 'js', go: 'go', rust: 'rust' };
export const FRAMEWORK = { python: 'Hypothesis', javascript: 'fast-check', go: 'rapid', rust: 'proptest' };
const HOW_TO_RUN = {
  python: (f) => `Save it as \`${f}\` in your tests and run \`pytest ${f}\`.`,
  javascript: (f) => `Run it with \`node --test ${f}\` (fix the import path if you move it).`,
  go: (f) => `Copy it into the package directory as \`${f}\` and run \`go test -run Repro .\`.`,
  rust: (f) => `Copy it into \`tests/${f}\` and run \`cargo test --test ${f.replace(/\.rs$/, '')}\`.`,
};

function fence(lang) { return FENCE[lang] || ''; }

export function bugMarkdown(b, result) {
  const v = b.verification;
  const r = b.review || {};
  const title = r.title || b.title;
  const where = v.site ? `\`${v.site.file}:${v.site.line}\`` : `\`${b.file}\``;
  const lines = [
    `# ${title}`,
    '',
    `| | |`, `|---|---|`,
    `| Function | \`${b.function}\` in ${where} |`,
    `| Kind | ${KIND[v.kind] || v.kind}${v.explicitRaise ? ' (explicit raise)' : ''} |`,
    r.verdict ? `| Review | ${r.verdict === 'bug' ? 'confirmed' : r.verdict}, confidence ${Number(r.confidence).toFixed(2)}, severity ${r.severity} |` : null,
    `| Reproduced | ${v.runs}/${v.runs} runs, same failure each time |`,
    '',
    '## What goes wrong',
    '',
    `**Input:** ${b.input}`,
    '',
    `**Expected:** ${b.expected}`,
    '',
    `**Actual:** ${v.kind === 'assertion' ? b.actual : `\`${v.error.type}: ${String(v.error.message).split('\n')[0].slice(0, 200)}\``}`,
    '',
    '## Reproduce',
    '',
    '```' + fence(result.lang),
    b.reproSource.trim(),
    '```',
    '',
    `Fails with \`${v.error.type}: ${String(v.error.message).split('\n')[0].slice(0, 200)}\``,
    HOW_TO_RUN[result.lang] ? `\n${HOW_TO_RUN[result.lang](v.reproFile)}` : '',
    '',
    '## Why this is a bug',
    '',
    b.evidence || '',
    r.reason ? `\nIndependent review: ${r.reason}` : '',
    '',
    '## How it was found',
    '',
    `Property: *${b.property}*.`,
    b.propertyCheck?.example ? `\n${FRAMEWORK[result.lang] || 'The property-based test'} shrank the failure to: \`${b.propertyCheck.example.replace(/\s+/g, ' ').slice(0, 300)}\`` : '',
    '',
    '---',
    `Found by [proofhound](https://github.com/FengXiao1231/proofhound): property-based test → shrunk counterexample → deterministic repro replayed ${v.runs}/${v.runs} times → independent review.`,
    '',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/** Write one folder per confirmed bug: BUG.md (issue-ready) plus the standalone repro test. */
export function writeBugs(repo, runRel, result) {
  const outDir = path.join(repo, runRel, 'bugs');
  const written = [];
  const bugs = result.findings.filter((f) => f.status === 'confirmed' || f.status === 'needs-look');
  for (const b of bugs) {
    const workdir = path.join(repo, b.workdir);
    const name = `${b.bugId || 'LOOK'}-${slug(b.review?.title || b.title, 48)}`;
    const dir = path.join(outDir, b.status === 'confirmed' ? '' : 'needs-look', name);
    let src = fs.readFileSync(path.join(workdir, b.verification.reproFile), 'utf8');
    if (result.lang === 'javascript') src = relocateImports(src, workdir, dir);
    b.reproSource = src;
    writeFile(path.join(dir, b.verification.reproFile), src);
    writeFile(path.join(dir, 'BUG.md'), bugMarkdown(b, result));
    b.bugDir = path.relative(repo, dir).split(path.sep).join('/');
    written.push(b.bugDir);
  }
  return written;
}
