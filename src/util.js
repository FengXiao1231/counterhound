import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const useColor = process.stderr.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = {
  bold: paint('1'), dim: paint('2'), red: paint('31'), green: paint('32'),
  yellow: paint('33'), blue: paint('34'), magenta: paint('35'), cyan: paint('36'),
};

let quiet = false;
export function setQuiet(q) { quiet = q; }
export function log(...args) { if (!quiet) process.stderr.write(args.join(' ') + '\n'); }

/** Run a command synchronously; never throws. */
export function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  return { code: r.status ?? (r.error ? 127 : 1), stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

/** Run a command asynchronously with a timeout; resolves { code, stdout, stderr, ms, timedOut }. */
export function run(cmd, args, { cwd, env, timeoutMs = 0, input, maxOutput = 16 * 1024 * 1024, onStdout } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: env || process.env, detached: process.platform !== 'win32' });
    } catch (error) {
      resolve({ code: 127, stdout: '', stderr: String(error), ms: 0, timedOut: false });
      return;
    }
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', (d) => {
      const s = d.toString();
      if (stdout.length < maxOutput) stdout += s;
      if (onStdout) onStdout(s);
    });
    child.stderr.on('data', (d) => { if (stderr.length < maxOutput) stderr += d.toString(); });
    let timer;
    if (timeoutMs > 0) timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.on('error', (error) => { stderr += String(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 128 : 1), stdout, stderr, ms: Date.now() - started, timedOut });
    });
    child.stdin.on('error', () => {});
    if (input != null) child.stdin.end(input); else child.stdin.end();
  });
}

function killTree(child) {
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL');
  } catch {
    try { child.kill('SIGKILL'); } catch { /* gone */ }
  }
}

export function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function tail(s, n = 4000) {
  s = String(s ?? '');
  return s.length > n ? '…' + s.slice(-n) : s;
}

export function head(s, n = 4000) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function slug(s, max = 40) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, max).replace(/^-|-$/g, '') || 'x';
}

export function hash(s, n = 10) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, n);
}

export function fmtMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '–';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

export function fmtUsd(v) {
  if (v == null || Number.isNaN(v)) return '–';
  return v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`;
}

/** Run async jobs with bounded concurrency; `fn` may return `STOP` to halt scheduling. */
export const STOP = Symbol('stop');
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0, stopped = false;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (!stopped && next < items.length) {
      const i = next++;
      const r = await fn(items[i], i);
      if (r === STOP) stopped = true; else results[i] = r;
    }
  });
  await Promise.all(workers);
  return results;
}

/** Find the first JSON object/array in text (agents sometimes wrap output in prose or fences). */
export function extractJSON(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced && fenced[1], text];
  for (const cand of candidates) {
    if (!cand) continue;
    try { return JSON.parse(cand.trim()); } catch { /* keep looking */ }
    for (const open of ['{', '[']) {
      const start = cand.indexOf(open);
      if (start < 0) continue;
      const close = open === '{' ? '}' : ']';
      for (let end = cand.lastIndexOf(close); end > start; end = cand.lastIndexOf(close, end - 1)) {
        try { return JSON.parse(cand.slice(start, end + 1)); } catch { /* shrink */ }
      }
    }
  }
  return null;
}

export function relPath(root, p) {
  const r = path.relative(root, p);
  return r.startsWith('..') ? p : r.split(path.sep).join('/');
}
