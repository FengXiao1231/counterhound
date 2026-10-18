import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { python } from './lang/python.js';
import { javascript } from './lang/javascript.js';
import { go } from './lang/go.js';
import { rust } from './lang/rust.js';
import { java } from './lang/java.js';
import { pickAgent } from './agents.js';
import { planGroups } from './targets.js';
import { hunt, HOME } from './hunt.js';
import { classify } from './verify.js';
import { writeBugs } from './report/bugs.js';
import { writeHtmlReport } from './report/html.js';
import { summaryMarkdown } from './report/summary.js';
import { postComment } from './github.js';
import { defaultBase, changedLines, touchedTargets } from './diff.js';
import { c, log, readJSON, writeJSON, fmtUsd, setQuiet } from './util.js';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'proofhound.js');
const LANGS = { python, py: python, javascript, js: javascript, ts: javascript, typescript: javascript, go, golang: go, rust, rs: rust, java };
const VERSION = JSON.parse(fs.readFileSync(path.join(path.dirname(BIN), '..', 'package.json'), 'utf8')).version;

const HELP = `proofhound ${VERSION} — an AI bug hunter that only reports bugs it can prove.

It reads your code, infers properties the functions should satisfy, writes
property-based tests (Hypothesis for Python, fast-check for JS/TS, rapid for Go,
proptest for Rust, QuickTheories for Java), runs them,
replays every failure as a deterministic repro, and has an independent reviewer
try to refute it. You only see bugs that survive all of that.

Usage
  proofhound [paths...]            hunt for bugs (default: the current directory)
  proofhound targets [paths...]    show which functions would be tested, no AI calls
  proofhound report                rebuild the HTML report for the latest run
  proofhound doctor                check that the toolchain is ready

Options
  --lang <python|js|go|rust|java>  language (auto-detected)
  --agent <claude|codex>    which coding-agent CLI does the thinking (auto-detected)
  --model <name>            model for the hunter, e.g. sonnet, opus
  --review-model <name>     model for the reviewer (defaults to --model)
  --api                     hunt the HTTP API (FastAPI, Flask, Express, Fastify routes) instead of functions
  --only <names>            comma-separated functions, modules or files to focus on
  --max-modules <n>         how many modules to hunt in (default 6)
  --per-module <n>          functions per module (default 6)
  -j, --jobs <n>            modules hunted in parallel (default 2)
  --runs <n>                times each repro must fail to count (default 3)
  --budget <usd>            stop starting new work after spending this much
  --min-confidence <0-1>    reviewer confidence needed to confirm (default 0.6)
  --no-review               skip the independent review step
  --notes <text>            extra context for the hunter (contracts, known quirks)
  --diff [ref]              only hunt in functions changed since ref (default: the
                            PR base in GitHub Actions, else origin's default branch)
  --summary-file <path>     also write a Markdown summary (for PR comments / CI)
  --fix                     also write a patch for each confirmed bug, kept only if the
                            repro then passes and the project's own tests still pass
  --fix-budget <usd>        extra spend allowed for fixes on top of --budget (default: half of it)
  --json                    print results as JSON on stdout
  -q, --quiet               less output
  -h, --help / -v, --version
`;

export function parseArgs(argv) {
  const o = { paths: [], _: [] };
  const take = (i) => { if (i + 1 >= argv.length) throw new Error(`${argv[i]} needs a value`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    const val = () => (inline !== undefined ? inline : take(i++));
    switch (flag) {
      case '-h': case '--help': o.help = true; break;
      case '-v': case '--version': o.version = true; break;
      case '--lang': o.lang = val(); break;
      case '--agent': o.agent = val(); break;
      case '--model': o.model = val(); break;
      case '--review-model': o.reviewModel = val(); break;
      case '--only': o.only = val().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--max-modules': o.maxGroups = +val(); break;
      case '--per-module': o.perGroup = +val(); break;
      case '-j': case '--jobs': o.jobs = +val(); break;
      case '--runs': o.runs = Math.max(1, +val()); break;
      case '--budget': o.budget = +val(); break;
      case '--fix-budget': o.fixBudget = +val(); break;
      case '--min-confidence': o.minConfidence = +val(); break;
      case '--no-review': o.review = false; break;
      case '--notes': o.notes = val(); break;
      case '--diff':
        if (inline !== undefined) o.diff = inline;
        else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) o.diff = argv[++i];
        else o.diff = true;
        break;
      case '--summary-file': o.summaryFile = val(); break;
      case '--fix': o.fix = true; break;
      case '--api': o.api = true; break;
      case '--keep-sandbox': o.keepSandbox = true; break;
      case '--report-url': o.reportUrl = val(); break;
      case '--json': o.json = true; break;
      case '-q': case '--quiet': o.quiet = true; break;
      default:
        if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
        o._.push(a);
    }
  }
  return o;
}

function detectLang(repo, name) {
  if (name) {
    const l = LANGS[name.toLowerCase()];
    if (!l) throw new Error(`unsupported language "${name}" (python, js, go, rust, java)`);
    return l;
  }
  // Compiled-language manifests at the root win: Python/JS files there are usually tooling.
  if (rust.detect(repo)) return rust;
  if (go.detect(repo)) return go;
  if (java.detect(repo)) return java;
  const isPy = python.detect(repo), isJs = javascript.detect(repo);
  if (isPy && !isJs) return python;
  if (isJs && !isPy) return javascript;
  if (isPy && isJs) {
    const pyMarkers = ['pyproject.toml', 'setup.py', 'setup.cfg'].some((f) => fs.existsSync(path.join(repo, f)));
    return pyMarkers ? python : javascript;
  }
  throw new Error('could not tell which language this project uses; pass --lang python, js, go, rust or java');
}

function loadConfig(repo, opts) {
  const cfg = readJSON(path.join(repo, HOME, 'config.json'), {});
  if (opts.notes) cfg.notes = [cfg.notes, opts.notes].filter(Boolean).join('\n');
  return cfg;
}

/** `proofhound _test <files>`: the test runner the hunter agent calls. Human-readable output. */
async function testCommand(argv) {
  // --repo <dir>: run against another copy of the project (the --fix sandbox)
  const ri = argv.indexOf('--repo');
  const repo = ri >= 0 ? path.resolve(argv[ri + 1]) : process.cwd();
  const files = ri >= 0 ? argv.filter((_, i) => i !== ri && i !== ri + 1) : argv;
  if (!files.length) { console.log('usage: ph-test <test file> [more files]'); return 2; }
  const cfg = loadConfig(repo, {});
  const byExt = { '.py': python, '.go': go, '.rs': rust, '.java': java };
  const lang = byExt[path.extname(files[0])] || javascript;
  const ts = lang === javascript;
  const abs = files.map((f) => path.resolve(process.cwd(), f));
  const r = await lang.runTests(repo, cfg, abs, { cwd: repo, timeoutMs: (cfg.testTimeoutSec || lang.testTimeoutSec || 300) * 1000, ts });
  if (r.timedOut) console.log('TIMEOUT: tests took too long and were killed. Use smaller inputs or fewer examples.');
  let passed = 0, failed = 0;
  for (const t of r.tests) {
    if (t.outcome === 'passed') { passed++; console.log(`PASS ${t.name}`); continue; }
    if (t.outcome === 'skipped') { console.log(`SKIP ${t.name}`); continue; }
    failed++;
    console.log(`${t.outcome === 'error' ? 'ERROR' : 'FAIL'} ${t.name}`);
    const e = t.error;
    if (e) {
      console.log(`  ${e.type}: ${String(e.message).split('\n').slice(0, 8).join('\n  ')}`);
      if (e.example) console.log(`  ${e.example.split('\n').join('\n  ')}`);
      const cls = classify(e, { repo, workdir: path.dirname(abs[0]), lang });
      if (cls.kind === 'test-error') console.log(`  note: this looks like a problem in the test (${cls.reason})`);
      else if (cls.site) console.log(`  raised in project code at ${cls.site.file}:${cls.site.line}${cls.site.func ? ` in ${cls.site.func}` : ''}${cls.explicitRaise ? ' (explicit raise: check whether it is documented)' : ''}`);
      else console.log('  assertion failed in the test (the code returned a different result)');
    } else if (t.longrepr) {
      console.log('  ' + t.longrepr.split('\n').slice(-25).join('\n  '));
    }
  }
  if (!r.tests.length) console.log(r.output.trim().split('\n').slice(-40).join('\n') || 'no tests ran');
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed ? 1 : 0;
}

/** `proofhound _comment <summary.md> [--only-if-bugs] [--has-bugs]`: post or update the PR comment (GitHub Action). */
async function commentCommand(args) {
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { log('usage: proofhound _comment <summary.md> [--only-if-bugs] [--has-bugs]'); return 2; }
  try {
    const what = await postComment(fs.readFileSync(file, 'utf8'), { onlyIfBugs: args.includes('--only-if-bugs'), hasBugs: args.includes('--has-bugs') });
    log(`proofhound: pull request comment ${what}`);
    return 0;
  } catch (e) {
    log(c.red(`proofhound: could not comment on the pull request: ${e.message}`));
    return 1;
  }
}

function printSummary(result, written, htmlPath) {
  const k = result.counts;
  const bugs = result.findings.filter((f) => f.status === 'confirmed').sort((a, b) => a.bugId.localeCompare(b.bugId));
  const look = result.findings.filter((f) => f.status === 'needs-look');
  log('');
  log(c.dim(`  ${k.reported} reported → ${k.verified} reproduced → ${k.verified - k.duplicates} unique → ${k.confirmed} confirmed by review`));
  if (!bugs.length && !look.length) {
    log(c.green('\n  No provable bugs found.') + c.dim(' Every reported failure was either not reproducible or refuted.'));
  }
  for (const b of bugs) {
    const where = b.verification.site ? `${b.verification.site.file}:${b.verification.site.line}` : b.file;
    log(`\n  ${c.red('●')} ${c.bold(`${b.bugId} ${b.review?.title || b.title}`)}`);
    log(c.dim(`    ${b.function} · ${where} · ${b.review ? `${b.review.severity}, confidence ${b.review.confidence.toFixed(2)}` : 'unreviewed'}`));
    log(`    input: ${String(b.input).slice(0, 160)}`);
    log(`    expected ${String(b.expected).slice(0, 120)}`);
    log(`    actual   ${b.verification.kind === 'assertion' ? String(b.actual).slice(0, 120) : `${b.verification.error.type}: ${String(b.verification.error.message).split('\n')[0].slice(0, 100)}`}`);
    if (b.fix) log(b.fix.status === 'verified' ? c.green(`    fix      verified patch to ${b.fix.files.join(', ')} (project tests ${b.fix.suite.split(' (')[0]})`) : c.dim(`    fix      none: ${b.fix.reason}`));
  }
  if (look.length) log(c.yellow(`\n  ${look.length} more reproduced but the reviewer was not sure; see needs-look/ in the report.`));
  if (written.length || htmlPath) {
    log('');
    if (written.length) log(c.dim(`  Issue-ready write-ups and repro tests: ${path.dirname(written[0]).replace(/\/needs-look$/, '')}/`));
    if (htmlPath) log(c.dim(`  Report: ${htmlPath}`));
  }
  log('');
}

export async function main(argv) {
  if (argv[0] === '_test') return testCommand(argv.slice(1));
  if (argv[0] === '_comment') return commentCommand(argv.slice(1));
  let opts;
  try { opts = parseArgs(argv); } catch (e) { log(c.red(e.message)); log(HELP); return 2; }
  if (opts.help) { console.log(HELP); return 0; }
  if (opts.version) { console.log(VERSION); return 0; }
  if (opts.quiet) setQuiet(true);
  const cmd = ['targets', 'report', 'doctor', 'hunt'].includes(opts._[0]) ? opts._.shift() : 'hunt';
  const repo = process.cwd();
  opts.paths = opts._;
  try {
    if (opts.diff === true) opts.diff = defaultBase(repo);
    const lang = detectLang(repo, opts.lang);
    const cfg = loadConfig(repo, opts);

    if (cmd === 'doctor') {
      const chk = lang.check(repo, cfg);
      log(chk.ok ? `${c.green('✓')} ${chk.info}` : `${c.red('✗')} ${chk.problem}`);
      for (const name of ['claude', 'codex']) {
        try { pickAgent(name); log(`${c.green('✓')} ${name} CLI found`); } catch { log(c.dim(`· ${name} CLI not found`)); }
      }
      return chk.ok ? 0 : 1;
    }

    if (cmd === 'targets') {
      let targets;
      if (opts.api) {
        const found = lang.listRoutes?.(repo, cfg, opts.paths);
        if (!found) { console.log('no HTTP routes found'); return 0; }
        targets = found.targets;
        console.log(c.dim(`HTTP API: ${found.api.framework}${found.api.app ? `, app ${found.api.app.module}:${found.api.app.name}${found.api.app.factory ? '()' : ''}` : ''}${found.api.openapiError ? ` (app could not be imported: ${found.api.openapiError})` : ''}`));
      } else targets = lang.listTargets(repo, cfg, opts.paths);
      if (opts.diff) targets = touchedTargets(targets, changedLines(repo, opts.diff));
      const groups = planGroups(targets, { maxGroups: opts.maxGroups || 20, perGroup: opts.perGroup || 6, only: opts.only, all: Boolean(opts.diff) });
      if (opts.json) { console.log(JSON.stringify(groups, null, 2)); return 0; }
      for (const g of groups) {
        console.log(`${c.bold(g.file)} ${c.dim(`score ${g.score}`)}`);
        for (const f of g.functions) console.log(`  ${String(f.score).padStart(5)}  ${f.qualname}${c.dim(f.signature)}${f.why.length ? c.dim(`  — ${f.why.join(', ')}`) : ''}`);
      }
      if (!groups.length) console.log(opts.api ? 'no routes found' : 'no candidate functions found');
      return 0;
    }

    if (cmd === 'report') {
      const latest = readJSON(path.join(repo, HOME, 'latest.json'), null);
      if (!latest) throw new Error('no runs yet: run `proofhound` first');
      const result = readJSON(path.join(repo, latest.results), null);
      const runRel = path.dirname(latest.results);
      const written = writeBugs(repo, runRel, result);
      const html = writeHtmlReport(repo, runRel, result);
      printSummary(result, written, html);
      return 0;
    }

    const chk = lang.check(repo, cfg);
    if (!chk.ok) throw new Error(chk.problem);
    log(c.dim(chk.info));
    const agent = pickAgent(opts.agent);
    const { result, runRel } = await hunt({
      repo, cfg, lang, agent, binPath: BIN,
      opts: { ...opts, maxGroups: opts.maxGroups || 6, perGroup: opts.perGroup || 6 },
    });
    const written = writeBugs(repo, runRel, result);
    writeJSON(path.join(repo, runRel, 'results.json'), result);
    const html = writeHtmlReport(repo, runRel, result);
    const md = summaryMarkdown(result, { reportUrl: opts.reportUrl });
    fs.writeFileSync(path.join(repo, runRel, 'summary.md'), md);
    if (opts.summaryFile) fs.writeFileSync(path.resolve(opts.summaryFile), md);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    printSummary(result, written, html);
    return result.counts.confirmed ? 1 : 0;
  } catch (e) {
    log(c.red(`proofhound: ${e.message}`));
    if (process.env.PROOFHOUND_DEBUG) log(e.stack);
    return 2;
  }
}
