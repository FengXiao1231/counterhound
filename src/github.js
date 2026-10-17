// Posting the run summary on a pull request, for the GitHub Action. Uses only the REST API and
// the environment GitHub Actions provides (GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH).
import fs from 'node:fs';
import { MARKER } from './report/summary.js';

function prNumber(env) {
  if (env.PROOFHOUND_PR) return Number(env.PROOFHOUND_PR);
  try {
    const ev = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    return ev.pull_request?.number || ev.number || null;
  } catch { return null; }
}

async function api(env, method, url, body) {
  const res = await fetch(`${env.GITHUB_API_URL || 'https://api.github.com'}${url}`, {
    method,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28', 'content-type': 'application/json', 'user-agent': 'proofhound',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub API ${method} ${url} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

/**
 * Create or update proofhound's comment on the pull request. With `onlyIfBugs`, a clean run
 * does not add a new comment, but still updates an earlier one so it does not go stale.
 * Returns 'created' | 'updated' | 'skipped'.
 */
export async function postComment(body, { env = process.env, onlyIfBugs = false, hasBugs = false } = {}) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY must be set');
  const pr = prNumber(env);
  if (!pr) return 'skipped';
  const base = `/repos/${env.GITHUB_REPOSITORY}/issues`;
  let existing = null;
  for (let page = 1; page <= 10 && !existing; page++) {
    const list = await api(env, 'GET', `${base}/${pr}/comments?per_page=100&page=${page}`);
    existing = list.find((c) => typeof c.body === 'string' && c.body.includes(MARKER)) || null;
    if (list.length < 100) break;
  }
  if (existing) { await api(env, 'PATCH', `${base}/comments/${existing.id}`, { body }); return 'updated'; }
  if (onlyIfBugs && !hasBugs) return 'skipped';
  await api(env, 'POST', `${base}/${pr}/comments`, { body });
  return 'created';
}
