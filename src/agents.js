import path from 'node:path';
import { run, sh, extractJSON } from './util.js';

/**
 * Agent backends drive an existing coding-agent CLI in headless mode, so proofhound
 * works with whatever subscription or API key the user already has.
 *
 * call({ prompt, cwd, writeDirs, runCommands, readOnly, model, timeoutMs, budgetUsd })
 *   -> { ok, text, costUsd, tokensIn, tokensOut, turns, ms, error }
 */

const claude = {
  id: 'claude',
  available() { return sh('claude', ['--version']).code === 0; },
  async call({ prompt, cwd, writeDirs = [], runCommands = [], model, timeoutMs = 900000, budgetUsd, env }) {
    const allowed = ['Read', 'Glob', 'Grep', 'TodoWrite'];
    for (const d of writeDirs) { const g = d === '.' ? './**' : `./${d}/**`; allowed.push(`Write(${g})`, `Edit(${g})`); }
    for (const cmd of runCommands) {
      allowed.push(`Bash(${cmd}:*)`, `Bash(${cmd})`);
      if (cmd.startsWith('./')) allowed.push(`Bash(${cmd.slice(2)}:*)`, `Bash(${path.join(cwd, cmd.slice(2))}:*)`);
    }
    const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'dontAsk',
      '--allowedTools', ...allowed, '--disallowedTools', 'WebFetch', 'WebSearch', 'Task', 'Agent',
      '--no-session-persistence'];
    if (model) args.push('--model', model);
    if (budgetUsd) args.push('--max-budget-usd', String(budgetUsd));
    const r = await run('claude', args, { cwd, timeoutMs, env: { ...process.env, ...(env || {}) } });
    const data = extractJSON(r.stdout) || {};
    const u = data.usage || {};
    return {
      ok: r.code === 0 && !data.is_error && !r.timedOut,
      text: typeof data.result === 'string' ? data.result : r.stdout,
      costUsd: data.total_cost_usd ?? null,
      tokensIn: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      tokensOut: u.output_tokens || 0,
      turns: data.num_turns ?? null,
      ms: r.ms,
      denials: (data.permission_denials || []).map((d) => `${d.tool_name}: ${JSON.stringify(d.tool_input).slice(0, 300)}`),
      error: r.timedOut ? 'timed out' : r.code !== 0 ? (r.stderr || r.stdout).trim().slice(-500) : data.is_error ? String(data.result || data.subtype) : null,
    };
  },
};

const codex = {
  id: 'codex',
  available() { return sh('codex', ['--version']).code === 0; },
  async call({ prompt, cwd, model, timeoutMs = 900000, readOnly, env }) {
    const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', readOnly ? 'read-only' : 'workspace-write', '-C', cwd];
    if (model) args.push('-m', model);
    args.push(prompt);
    const r = await run('codex', args, { cwd, timeoutMs, env: { ...process.env, ...(env || {}) } });
    let text = '', tokensIn = 0, tokensOut = 0, turns = 0;
    for (const line of r.stdout.split('\n')) {
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const item = ev.item || ev.msg || {};
      if ((ev.type === 'item.completed' && (item.type === 'agent_message' || item.item_type === 'assistant_message')) || item.type === 'agent_message') {
        text = item.text || item.message || text;
      }
      if (ev.type === 'turn.completed' && ev.usage) {
        turns++;
        tokensIn += (ev.usage.input_tokens || 0) + (ev.usage.cached_input_tokens || 0);
        tokensOut += ev.usage.output_tokens || 0;
      }
    }
    return {
      ok: r.code === 0 && !r.timedOut, text, costUsd: null, tokensIn, tokensOut, turns, ms: r.ms,
      error: r.timedOut ? 'timed out' : r.code !== 0 ? (r.stderr || '').trim().slice(-500) : null,
    };
  },
};

/** Replays canned responses; used by proofhound's own tests (PROOFHOUND_FAKE_AGENT=module path). */
const fake = {
  id: 'fake',
  available() { return Boolean(process.env.PROOFHOUND_FAKE_AGENT); },
  async call(opts) {
    const mod = await import(process.env.PROOFHOUND_FAKE_AGENT);
    const started = Date.now();
    const text = await mod.default(opts);
    return { ok: true, text, costUsd: 0, tokensIn: 0, tokensOut: 0, turns: 1, ms: Date.now() - started, error: null };
  },
};

export const AGENTS = { claude, codex, fake };

export function pickAgent(name) {
  if (name) {
    const a = AGENTS[name];
    if (!a) throw new Error(`unknown agent "${name}" (choose: claude, codex)`);
    if (!a.available()) throw new Error(`the ${name} CLI was not found on PATH`);
    return a;
  }
  for (const a of [claude, codex]) if (a.available()) return a;
  throw new Error('no supported agent CLI found. Install Claude Code (`claude`) or Codex (`codex`), or pass --agent');
}
