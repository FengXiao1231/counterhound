// Diff mode: only hunt in functions whose bodies a change touched (for pull requests in CI).
import { sh } from './util.js';

/** The ref to diff against when none is given: the PR base in GitHub Actions, else origin's default branch. */
export function defaultBase(repo) {
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  const head = sh('git', ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], { cwd: repo });
  if (head.code === 0) return head.stdout.trim().replace(/^refs\/remotes\//, '');
  for (const b of ['origin/main', 'origin/master', 'main', 'master']) {
    if (sh('git', ['rev-parse', '--verify', '--quiet', b], { cwd: repo }).code === 0) return b;
  }
  throw new Error('could not find a base branch to diff against; pass --diff <ref>');
}

/** Changed line ranges per file (repo-relative paths), from the merge base of `base` to the working tree. */
export function changedLines(repo, base) {
  const mb = sh('git', ['merge-base', base, 'HEAD'], { cwd: repo });
  if (mb.code !== 0) throw new Error(`git could not find ${base}: ${mb.stderr.trim().split('\n').pop()}. In GitHub Actions, check out with fetch-depth: 0`);
  const r = sh('git', ['diff', '--unified=0', '--no-color', '--no-ext-diff', '--diff-filter=AMR', '--relative', mb.stdout.trim()], { cwd: repo });
  if (r.code !== 0) throw new Error(`git diff failed: ${r.stderr.trim()}`);
  return parseDiff(r.stdout);
}

/** Parse `git diff --unified=0` into Map(file -> [[start, end], ...]) of new-side lines. */
export function parseDiff(text) {
  const out = new Map();
  let file = null;
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/^\+\+\+ (?:b\/)?(.*)$/))) {
      file = m[1] === '/dev/null' ? null : m[1];
      if (file && !out.has(file)) out.set(file, []);
    } else if (file && (m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/))) {
      const start = +m[1];
      const count = m[2] === undefined ? 1 : +m[2];
      // a pure deletion (count 0) still changes the function around it
      out.get(file).push(count === 0 ? [start, start + 1] : [start, start + count - 1]);
    }
  }
  return out;
}

/** Keep targets whose [line, line + loc) overlaps a changed range. */
export function touchedTargets(targets, changes) {
  return targets.filter((t) => {
    const ranges = changes.get(t.file);
    if (!ranges) return false;
    const a = t.line, b = t.line + Math.max(1, t.loc || 1) - 1;
    return ranges.some(([s, e]) => s <= b && e >= a);
  });
}
