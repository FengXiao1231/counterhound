import fs from 'node:fs';
import path from 'node:path';
import { hunterPrompt, reviewerPrompt } from './prompts.js';
import { verifyFinding, confirmProperty } from './verify.js';
import { planGroups } from './targets.js';
import { c, log, pool, STOP, writeJSON, writeFile, extractJSON, slug, fmtUsd, fmtMs } from './util.js';

export const HOME = '.proofhound';

export function runId(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Shell wrapper the agent is allowed to call; it runs tests through proofhound's own runner. */
export function writeTestWrapper(repo, binPath) {
  const file = path.join(repo, HOME, 'ph-test');
  const script = `#!/bin/sh\n# Runs tests the way proofhound will verify them. Generated; safe to delete.\nexec "${process.execPath}" "${binPath}" _test "$@"\n`;
  writeFile(file, script);
  fs.chmodSync(file, 0o755);
  const gi = path.join(repo, HOME, '.gitignore');
  if (!fs.existsSync(gi)) writeFile(gi, 'runs/\nnode_modules\nph-test\n');
  return `./${HOME}/ph-test`;
}

function readFindings(workdir) {
  const file = path.join(workdir, 'findings.json');
  if (!fs.existsSync(file)) return [];
  const data = extractJSON(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(data) ? data : Array.isArray(data?.findings) ? data.findings : [];
  return list.filter((f) => f && typeof f === 'object' && f.title);
}

function dedupKey(f) {
  if (f.verification.kind === 'assertion') return `a:${f.function}:${slug(f.property || f.title, 60)}`;
  return `s:${f.verification.signature}`;
}

/** The hunt: plan → (hunt → verify) per group → dedup → review → results. */
export async function hunt({ repo, cfg, lang, agent, opts, binPath }) {
  const started = Date.now();
  const id = runId();
  const runRel = `${HOME}/runs/${id}`;
  const runDir = path.join(repo, runRel);
  const testCmd = writeTestWrapper(repo, binPath);
  lang.prepare?.(repo, path.join(repo, HOME), cfg);

  const targets = lang.listTargets(repo, cfg, opts.paths || []);
  const groups = planGroups(targets, { maxGroups: opts.maxGroups, perGroup: opts.perGroup, only: opts.only });
  if (!groups.length) throw new Error('no candidate functions found. Point proofhound at a source directory, or use --only');
  const ts = lang.needsTs(groups.flatMap((g) => g.functions.map((f) => f.file)));
  log(c.bold(`\nproofhound`) + c.dim(` · ${lang.name} · ${agent.id}${opts.model ? ` (${opts.model})` : ''} · ${groups.length} module${groups.length > 1 ? 's' : ''}, ${groups.reduce((a, g) => a + g.functions.length, 0)} functions\n`));

  const spend = { usd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
  const account = (r) => { spend.usd += r.costUsd || 0; spend.tokensIn += r.tokensIn || 0; spend.tokensOut += r.tokensOut || 0; spend.calls++; };
  const overBudget = () => opts.budget && spend.usd >= opts.budget;
  const all = [];
  const groupLog = [];

  await pool(groups, opts.jobs || 2, async (group) => {
    if (overBudget()) { log(c.yellow(`  budget of ${fmtUsd(opts.budget)} reached, skipping remaining modules`)); return STOP; }
    const workRel = `${runRel}/${group.id}`;
    const workdir = path.join(repo, workRel);
    fs.mkdirSync(workdir, { recursive: true });
    lang.prepareGroup?.(repo, group, workdir, cfg);
    const imports = group.functions.slice(0, 3).map((f) => lang.importHint(f, workdir, repo));
    const prompt = hunterPrompt({ lang, group, workdir: workRel, testCmd, imports: [...new Set(imports)], notes: cfg.notes });
    writeFile(path.join(workdir, 'prompt.md'), prompt);
    log(c.dim(`  ▸ hunting in ${group.file} (${group.functions.map((f) => f.name).join(', ')})`));
    const r = await agent.call({
      prompt, cwd: repo, writeDirs: [workRel], runCommands: [testCmd], model: opts.model,
      timeoutMs: (cfg.agentTimeoutSec || 1200) * 1000, budgetUsd: opts.perModuleBudget,
    });
    account(r);
    writeFile(path.join(workdir, 'agent.txt'), `${r.text || ''}\n\n${r.error ? `ERROR: ${r.error}\n` : ''}${r.denials?.length ? `Permission denials:\n${r.denials.join('\n')}\n` : ''}`);
    const findings = readFindings(workdir);
    const entry = { group: group.id, file: group.file, functions: group.functions.map((f) => f.qualname), agentOk: r.ok, agentError: r.error, ms: r.ms, costUsd: r.costUsd, reported: findings.length, verified: 0 };
    groupLog.push(entry);
    if (!r.ok && !findings.length) { log(c.red(`  ✗ ${group.file}: agent failed (${(r.error || '').split('\n')[0].slice(0, 120)})`)); return; }

    for (const f of findings) {
      const v = await verifyFinding(f, { repo, cfg, lang, workdir, runs: opts.runs || 3, ts });
      const finding = { ...f, group: group.id, file: group.file, workdir: workRel, verification: v };
      if (v.verified) {
        entry.verified++;
        finding.propertyCheck = await confirmProperty(f, { repo, cfg, lang, workdir, propsFile: lang.files().props, ts });
        log(`  ${c.green('✓')} ${c.bold(f.title)} ${c.dim(`(${v.kind}, failed ${v.runs}/${v.runs})`)}`);
      } else {
        log(`  ${c.dim('·')} ${c.dim(f.title)} ${c.yellow(`→ dropped: ${v.reason}`)}`);
      }
      all.push(finding);
    }
    if (!findings.length) log(c.dim(`  · ${group.file}: no bugs reported`));
  });

  // Dedup verified findings (same crash site, or same property on the same function).
  const verified = all.filter((f) => f.verification.verified);
  const seen = new Map();
  for (const f of verified) {
    const k = dedupKey(f);
    if (seen.has(k)) { f.duplicateOf = seen.get(k).title; continue; }
    seen.set(k, f);
  }
  const unique = verified.filter((f) => !f.duplicateOf);

  if (opts.review !== false && unique.length) {
    log(c.dim(`\n  reviewing ${unique.length} verified finding${unique.length > 1 ? 's' : ''} with an independent skeptic…`));
    await pool(unique, opts.jobs || 2, async (f) => {
      if (overBudget()) { f.review = { verdict: 'unclear', confidence: 0, reason: 'not reviewed: budget reached' }; return; }
      const workdir = path.join(repo, f.workdir);
      const reproSource = fs.readFileSync(path.join(workdir, f.verification.reproFile), 'utf8');
      const prompt = reviewerPrompt({ finding: f, verification: f.verification, reproSource, testCmd, workdir: f.workdir, lang });
      const r = await agent.call({ prompt, cwd: repo, writeDirs: [], runCommands: [testCmd], model: opts.reviewModel || opts.model, readOnly: true, timeoutMs: 600000 });
      account(r);
      const j = extractJSON(r.text) || {};
      f.review = {
        verdict: ['bug', 'not_a_bug', 'unclear'].includes(j.verdict) ? j.verdict : 'unclear',
        confidence: typeof j.confidence === 'number' ? Math.max(0, Math.min(1, j.confidence)) : 0,
        severity: j.severity || 'medium', category: j.category || f.kind, title: j.title || f.title,
        reason: j.reason || (r.ok ? 'reviewer gave no reason' : `review failed: ${r.error}`),
        maintainerWouldFix: j.maintainer_would_fix ?? null,
      };
      const mark = f.review.verdict === 'bug' ? c.green('bug') : f.review.verdict === 'not_a_bug' ? c.red('not a bug') : c.yellow('unclear');
      log(`  ${mark} ${c.dim(`(${f.review.confidence.toFixed(2)})`)} ${f.title}`);
    });
  }

  const minConf = opts.minConfidence ?? 0.6;
  for (const f of unique) {
    if (!f.review) f.status = 'confirmed';
    else if (f.review.verdict === 'bug' && f.review.confidence >= minConf) f.status = 'confirmed';
    else if (f.review.verdict === 'not_a_bug') f.status = 'rejected';
    else f.status = 'needs-look';
  }
  const rank = { high: 0, medium: 1, low: 2 };
  const bugs = unique.filter((f) => f.status === 'confirmed')
    .sort((a, b) => (rank[a.review?.severity] ?? 1) - (rank[b.review?.severity] ?? 1) || (b.review?.confidence ?? 1) - (a.review?.confidence ?? 1));
  bugs.forEach((b, i) => { b.bugId = `PH-${String(i + 1).padStart(3, '0')}`; });

  const result = {
    version: 1, tool: 'proofhound', runId: id, repo: path.basename(repo), lang: lang.id, agent: agent.id, model: opts.model || null,
    startedAt: new Date(started).toISOString(), ms: Date.now() - started, spend,
    groups: groupLog,
    counts: {
      modules: groups.length, functions: groups.reduce((a, g) => a + g.functions.length, 0),
      reported: all.length, verified: verified.length, duplicates: verified.length - unique.length,
      confirmed: bugs.length, needsLook: unique.filter((f) => f.status === 'needs-look').length,
      rejectedByReview: unique.filter((f) => f.status === 'rejected').length,
      droppedByVerification: all.length - verified.length,
    },
    findings: all,
  };
  writeJSON(path.join(runDir, 'results.json'), result);
  writeJSON(path.join(repo, HOME, 'latest.json'), { runId: id, results: `${runRel}/results.json` });
  log(c.dim(`\n  ${fmtMs(result.ms)} · ${spend.calls} agent calls · ${spend.usd ? fmtUsd(spend.usd) : 'cost n/a'}`));
  return { result, runDir, runRel };
}
