import path from 'node:path';
import { writeFile, fmtMs, fmtUsd } from '../util.js';
import { FRAMEWORK } from './bugs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const KIND = { crash: 'crash', 'internal-assert': 'internal assert', assertion: 'wrong result' };

function funnel(k) {
  const steps = [
    ['reported by the hunter', k.reported],
    ['reproduced deterministically', k.verified],
    ['unique', k.verified - k.duplicates],
    ['confirmed by review', k.confirmed],
  ];
  const max = Math.max(1, k.reported);
  return `<div class="funnel">${steps.map(([label, n], i) => `
    <div class="step"><div class="bar" style="width:${Math.max(4, (n / max) * 100)}%" data-i="${i}"></div>
    <div class="lab"><b>${n}</b> ${label}</div></div>`).join('')}</div>`;
}

function bugCard(b, lang) {
  const v = b.verification, r = b.review || {};
  const where = v.site ? `${v.site.file}:${v.site.line}` : b.file;
  return `<article class="bug ${b.status}">
  <header>
    <span class="id">${esc(b.bugId || '?')}</span>
    <h3>${esc(r.title || b.title)}</h3>
    <span class="badges">
      <span class="badge kind">${esc(KIND[v.kind] || v.kind)}</span>
      ${r.severity ? `<span class="badge sev-${esc(r.severity)}">${esc(r.severity)}</span>` : ''}
      ${r.confidence != null ? `<span class="badge">confidence ${Number(r.confidence).toFixed(2)}</span>` : ''}
      <span class="badge ok">failed ${v.runs}/${v.runs}</span>
    </span>
  </header>
  <p class="where"><code>${esc(b.function)}</code> · <code>${esc(where)}</code></p>
  <dl>
    <dt>Input</dt><dd><code>${esc(b.input)}</code></dd>
    <dt>Expected</dt><dd>${esc(b.expected)}</dd>
    <dt>Actual</dt><dd>${v.kind === 'assertion' ? esc(b.actual) : `<code>${esc(v.error.type)}: ${esc(String(v.error.message).split('\n')[0].slice(0, 200))}</code>`}</dd>
    <dt>Property</dt><dd>${esc(b.property)}</dd>
  </dl>
  <details open><summary>Repro test <button class="copy" data-copy>copy</button></summary><pre><code>${esc((b.reproSource || '').trim())}</code></pre>
  <p class="err"><code>${esc(v.error.type)}: ${esc(String(v.error.message).split('\n')[0].slice(0, 240))}</code></p></details>
  <details><summary>Why this is a bug</summary><p>${esc(b.evidence)}</p>${r.reason ? `<p><b>Independent review:</b> ${esc(r.reason)}</p>` : ''}
  ${b.propertyCheck?.example ? `<p><b>${FRAMEWORK[lang] || 'The property test'} shrank it to:</b> <code>${esc(b.propertyCheck.example.slice(0, 400))}</code></p>` : ''}
  ${b.bugDir ? `<p class="dim">Issue write-up: <code>${esc(b.bugDir)}/BUG.md</code></p>` : ''}</details>
</article>`;
}

export function renderHtml(result) {
  const k = result.counts;
  const bugs = result.findings.filter((f) => f.status === 'confirmed').sort((a, b) => a.bugId.localeCompare(b.bugId));
  const look = result.findings.filter((f) => f.status === 'needs-look');
  const dropped = result.findings.filter((f) => !f.verification.verified || f.status === 'rejected' || f.duplicateOf);
  const reason = (f) => f.duplicateOf ? `duplicate of “${f.duplicateOf}”` : !f.verification.verified ? f.verification.reason : `reviewer: ${f.review?.reason || 'not a bug'}`;
  const stage = (f) => f.duplicateOf ? 'dedup' : !f.verification.verified ? 'replay' : 'review';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>proofhound · ${esc(result.repo)}</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1b18;--dim:#6b665e;--card:#fff;--line:#e6e1d8;--accent:#c2410c;--ok:#15803d;--warn:#b45309;--code:#f4f1ea;--bar1:#d6d3cd;--bar3:#c2410c}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--fg:#ece8e1;--dim:#9b958b;--card:#1d1b18;--line:#302d28;--accent:#fb923c;--ok:#4ade80;--warn:#fbbf24;--code:#25221e;--bar1:#3a3631;--bar3:#fb923c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:920px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:28px;margin:0 0 4px;letter-spacing:-.02em}h1 span{color:var(--accent)}h2{font-size:18px;margin:40px 0 12px}
.meta{color:var(--dim);font-size:13px}.meta code{font-size:12px}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
pre{background:var(--code);padding:12px 14px;border-radius:8px;overflow:auto;margin:8px 0}
.funnel{margin:20px 0 8px;display:grid;gap:6px}.step{position:relative;height:30px}
.bar{position:absolute;inset:0 auto 0 0;background:var(--bar1);border-radius:6px}.bar[data-i="3"]{background:var(--bar3)}
.lab{position:relative;padding:5px 10px;font-size:13px;white-space:nowrap}.bar[data-i="3"]+.lab{color:#fff}
.bug{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:16px 18px;margin:14px 0}
.bug.needs-look{border-left-color:var(--warn)}
.bug header{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}.bug h3{margin:0;font-size:17px;flex:1 1 300px}
.id{font:600 12px ui-monospace,monospace;color:var(--accent)}
.badges{display:flex;gap:6px;flex-wrap:wrap}.badge{font-size:11.5px;border:1px solid var(--line);border-radius:99px;padding:1px 8px;color:var(--dim)}
.badge.ok{color:var(--ok);border-color:currentColor}.sev-high{color:var(--accent);border-color:currentColor}.sev-medium{color:var(--warn);border-color:currentColor}
.where{margin:6px 0 10px;color:var(--dim);font-size:13px;word-break:break-all}
dl{display:grid;grid-template-columns:90px 1fr;gap:4px 12px;margin:0 0 8px}dt{color:var(--dim);font-size:13px}dd{margin:0;word-break:break-word}
details{margin-top:8px}summary{cursor:pointer;font-weight:600;font-size:13.5px}
.copy{margin-left:8px;font-size:11px;border:1px solid var(--line);background:transparent;color:var(--dim);border-radius:5px;cursor:pointer}
.err{color:var(--accent);margin:4px 0}.dim{color:var(--dim)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--dim);font-weight:500}
.empty{padding:24px;border:1px dashed var(--line);border-radius:10px;color:var(--dim);text-align:center}
.tag{font-size:11px;color:var(--dim);border:1px solid var(--line);border-radius:4px;padding:0 5px}
footer{margin-top:48px;color:var(--dim);font-size:12.5px}
@media (max-width:600px){dl{grid-template-columns:1fr}dt{margin-top:6px}}
</style></head><body><main>
<h1>proof<span>hound</span> report</h1>
<div class="meta">${esc(result.repo)} · ${esc(result.lang)} · ${esc(result.agent)}${result.model ? ` (${esc(result.model)})` : ''} · ${k.modules} modules, ${k.functions} functions · ${fmtMs(result.ms)}${result.spend?.usd ? ` · ${fmtUsd(result.spend.usd)}` : ''} · ${esc(new Date(result.startedAt).toLocaleString('en-US'))}</div>
${funnel(k)}
<p class="meta">Every bug below failed the same way in ${bugs[0]?.verification.runs || 3} fresh runs of a deterministic test, the failure comes from the project's own code (or is a wrong result), and an independent reviewer could not refute it.</p>

<h2>${bugs.length} confirmed bug${bugs.length === 1 ? '' : 's'}</h2>
${bugs.length ? bugs.map((b) => bugCard(b, result.lang)).join('\n') : '<div class="empty">No provable bugs. That is a real result: nothing the hunter reported survived replay and review.</div>'}

${look.length ? `<h2>${look.length} reproduced, reviewer unsure</h2>${look.map((b) => bugCard(b, result.lang)).join('\n')}` : ''}

<h2>Filtered out (${dropped.length})</h2>
${dropped.length ? `<table><tr><th>Finding</th><th>Stage</th><th>Why it was dropped</th></tr>${dropped.map((f) => `<tr><td>${esc(f.title)}<div class="dim"><code>${esc(f.function)}</code></div></td><td><span class="tag">${stage(f)}</span></td><td>${esc(reason(f))}</td></tr>`).join('')}</table>` : '<p class="dim">Nothing was filtered out.</p>'}

<h2>Modules</h2>
<table><tr><th>File</th><th>Functions</th><th>Reported</th><th>Reproduced</th><th>Time</th></tr>
${result.groups.map((g) => `<tr><td><code>${esc(g.file)}</code>${g.agentOk ? '' : ` <span class="tag">agent error</span>`}</td><td>${esc(g.functions.join(', '))}</td><td>${g.reported}</td><td>${g.verified}</td><td>${fmtMs(g.ms)}</td></tr>`).join('')}
</table>
<footer>Generated by proofhound. Raw data: <code>results.json</code> next to this file.</footer>
</main>
<script>
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const t=b.closest('details').querySelector('pre').innerText;navigator.clipboard&&navigator.clipboard.writeText(t).then(()=>{b.textContent='copied';setTimeout(()=>b.textContent='copy',1200)})}));
</script>
</body></html>`;
}

export function writeHtmlReport(repo, runRel, result) {
  const file = path.join(repo, runRel, 'report.html');
  writeFile(file, renderHtml(result));
  writeFile(path.join(repo, '.proofhound', 'report.html'), renderHtml(result));
  return path.relative(repo, file).split(path.sep).join('/');
}
