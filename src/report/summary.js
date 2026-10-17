// A Markdown summary of a run, sized for a pull request comment or a CI job summary.
import { fmtMs, fmtUsd } from '../util.js';
import { FENCE } from './bugs.js';

export const MARKER = '<!-- proofhound-report -->';

const KIND = { crash: 'crash', 'internal-assert': 'internal assert', assertion: 'wrong result' };
const cell = (s, n = 160) => String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, n);

function bugBlock(b, lang) {
  const v = b.verification;
  const r = b.review || {};
  const where = v.site ? `${v.site.file}:${v.site.line}` : b.file;
  const actual = v.kind === 'assertion' ? b.actual : `${v.error.type}: ${String(v.error.message).split('\n')[0]}`;
  return [
    `<details><summary><b>${b.bugId}</b> ${cell(r.title || b.title, 200)} <sub>(${KIND[v.kind] || v.kind}, ${where})</sub></summary>`,
    '',
    `| | |`, `|---|---|`,
    `| Function | \`${cell(b.function, 120)}\` |`,
    `| Input | ${cell(b.input)} |`,
    `| Expected | ${cell(b.expected)} |`,
    `| Actual | ${cell(actual)} |`,
    r.verdict ? `| Review | ${r.severity} severity, confidence ${Number(r.confidence).toFixed(2)} |` : null,
    '',
    r.reason ? `${cell(r.reason, 600)}\n` : null,
    `Failing test (\`${v.reproFile}\`, failed ${v.runs}/${v.runs} runs):`,
    '',
    '```' + (FENCE[lang] || ''),
    String(b.reproSource || '').trim().slice(0, 3000),
    '```',
    '</details>',
  ].filter((l) => l !== null).join('\n');
}

/**
 * `diff` is result.diff when the run was limited to a change; `reportUrl` links the full report
 * (e.g. the workflow run's artifacts).
 */
export function summaryMarkdown(result, { reportUrl } = {}) {
  const k = result.counts;
  const bugs = result.findings.filter((f) => f.status === 'confirmed').sort((a, b) => a.bugId.localeCompare(b.bugId));
  const look = result.findings.filter((f) => f.status === 'needs-look');
  const scope = result.diff
    ? `${k.functions} changed function${k.functions === 1 ? '' : 's'} in ${k.modules} module${k.modules === 1 ? '' : 's'}`
    : `${k.functions} functions in ${k.modules} modules`;
  const lines = [MARKER];
  if (result.diff && !k.functions) {
    lines.push('### proofhound: nothing to check', '', `This change does not touch any function proofhound can test (${result.diff.files} changed file${result.diff.files === 1 ? '' : 's'} compared with \`${result.diff.base}\`).`);
    return lines.join('\n') + '\n';
  }
  lines.push(bugs.length
    ? `### proofhound found ${bugs.length} provable bug${bugs.length > 1 ? 's' : ''}`
    : '### proofhound: no provable bugs');
  lines.push('', `Checked ${scope} with property-based tests. ${k.reported} reported → ${k.verified} reproduced → ${k.verified - k.duplicates} unique → ${k.confirmed} confirmed by an independent review.`, '');
  for (const b of bugs) lines.push(bugBlock(b, result.lang), '');
  if (look.length) lines.push(`${look.length} more failure${look.length > 1 ? 's' : ''} reproduced, but the reviewer was not sure ${look.length > 1 ? 'they are bugs' : 'it is a bug'}: ${look.map((b) => cell(b.review?.title || b.title, 100)).join('; ')}.`, '');
  const meta = [fmtMs(result.ms), result.spend?.usd ? `${fmtUsd(result.spend.usd)} of model usage` : null, reportUrl ? `[full report](${reportUrl})` : null].filter(Boolean).join(' · ');
  lines.push(`<sub>${meta} · [proofhound](https://github.com/FengXiao1231/proofhound) only reports failures that replay deterministically and survive review.</sub>`);
  return lines.join('\n') + '\n';
}
