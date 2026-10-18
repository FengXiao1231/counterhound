import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, sh, hash, readJSON } from '../util.js';

const CACHE = process.env.COUNTERHOUND_JAVA_CACHE || path.join(os.homedir(), '.cache', 'counterhound', 'java');
const CENTRAL = 'https://repo1.maven.org/maven2';
const JARS = [
  'org/junit/platform/junit-platform-console-standalone/1.14.4/junit-platform-console-standalone-1.14.4.jar',
  'org/quicktheories/quicktheories/0.26/quicktheories-0.26.jar',
];
const LAUNCHER = path.join(CACHE, path.basename(JARS[0]));
const SKIP_DIRS = new Set(['target', 'build', 'out', '.git', 'node_modules', '.gradle', '.idea', '.counterhound', 'test', 'tests', 'testFixtures', 'jmh', 'examples', 'samples']);

// --- toolchain: the runner and property-testing jars, and the project's classpath ---

function ensureJars() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const rel of JARS) {
    const dest = path.join(CACHE, path.basename(rel));
    if (fs.existsSync(dest)) continue;
    const r = sh('curl', ['-sSfL', '--retry', '4', '--retry-delay', '3', '-o', `${dest}.part`, `${CENTRAL}/${rel}`]);
    if (r.code !== 0) throw new Error(`could not download ${path.basename(rel)} from Maven Central: ${r.stderr.trim()}`);
    fs.renameSync(`${dest}.part`, dest);
  }
  return JARS.map((rel) => path.join(CACHE, path.basename(rel)));
}

/** Directories holding the project's main sources (src/main/java, per module), else the repo itself. */
export function sourceRoots(repo) {
  const roots = [];
  const walk = (dir, depth) => {
    const main = path.join(dir, 'src', 'main', 'java');
    if (fs.existsSync(main)) roots.push(main);
    if (depth <= 0) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name) && e.name !== 'src') walk(path.join(dir, e.name), depth - 1);
  };
  walk(repo, 3);
  return roots.length ? roots : [repo];
}

function javaFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) walk(p); }
      else if (e.name.endsWith('.java') && !/Tests?\.java$|^package-info\.java$|^module-info\.java$/.test(e.name)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** The project's dependency classpath, from Maven or Gradle when there is a build file. */
function dependencyClasspath(repo, out) {
  const file = path.join(out, 'deps.txt');
  if (fs.existsSync(path.join(repo, 'pom.xml'))) {
    const mvn = fs.existsSync(path.join(repo, 'mvnw')) ? './mvnw' : 'mvn';
    const r = sh(mvn, ['-q', '-B', 'dependency:build-classpath', `-Dmdep.outputFile=${file}`, '-Dmdep.appendOutput=true', '-Dmdep.pathSeparator=' + path.delimiter], { cwd: repo });
    if (r.code !== 0) return { cp: '', warning: `mvn dependency:build-classpath failed: ${(r.stdout + r.stderr).trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' ')}` };
  } else if (['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'].some((f) => fs.existsSync(path.join(repo, f)))) {
    const init = path.join(out, 'ph-classpath.gradle');
    fs.writeFileSync(init, `allprojects {
  afterEvaluate { p ->
    if (p.plugins.hasPlugin('java')) {
      p.tasks.register('phClasspath') { doLast { println 'PH_CP=' + p.sourceSets.main.compileClasspath.filter { it.exists() && !it.path.contains('/build/') }.asPath } }
    }
  }
}
`);
    const gradle = fs.existsSync(path.join(repo, 'gradlew')) ? './gradlew' : 'gradle';
    const r = sh(gradle, ['-q', '--init-script', init, 'phClasspath'], { cwd: repo });
    if (r.code !== 0) return { cp: '', warning: `gradle could not list the classpath: ${r.stderr.trim().split('\n').slice(-2).join(' ')}` };
    fs.writeFileSync(file, [...r.stdout.matchAll(/^PH_CP=(.*)$/gm)].map((m) => m[1]).filter(Boolean).join(path.delimiter));
  } else {
    return { cp: '' };
  }
  const cp = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split(/[\n:;]+/).filter(Boolean) : [];
  return { cp: [...new Set(cp)].join(path.delimiter) };
}

/**
 * Compile the project's main sources into .counterhound/java/classes (never into target/ or build/),
 * once per change of the sources. Returns { classes, deps, roots }.
 */
function ensureBuilt(repo, cfg = {}) {
  const out = path.join(repo, '.counterhound', 'java');
  const roots = sourceRoots(repo);
  const files = roots.flatMap(javaFiles);
  const stamp = hash(files.map((f) => `${f}:${fs.statSync(f).mtimeMs}`).join('\n'), 16);
  const meta = readJSON(path.join(out, 'build.json'), null);
  const classes = path.join(out, 'classes');
  if (meta?.stamp === stamp && fs.existsSync(classes)) return { classes, deps: meta.deps, roots };
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(classes, { recursive: true });
  const { cp: deps, warning } = cfg.classpath != null ? { cp: cfg.classpath } : dependencyClasspath(repo, out);
  const list = path.join(out, 'sources.txt');
  fs.writeFileSync(list, files.map((f) => JSON.stringify(f)).join('\n'));
  const r = sh('javac', ['-encoding', 'UTF-8', '-nowarn', '-parameters', '-proc:full', '-d', classes, ...(deps ? ['-cp', deps] : []), `@${list}`], { cwd: repo });
  if (r.code !== 0) {
    const errs = (r.stdout + r.stderr).split('\n').filter((l) => /error:/.test(l)).slice(0, 5).join('\n');
    throw new Error(`could not compile the project's sources with javac${warning ? ` (${warning})` : ''}:\n${errs}\nSet "classpath" in .counterhound/config.json if dependencies are missing.`);
  }
  fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify({ stamp, deps }));
  return { classes, deps, roots };
}

// --- scanning public methods ---

const IMPURE = /\b(System\.(out|err|currentTimeMillis|nanoTime|getenv|getProperty)|Files\.|new File\(|Socket|HttpClient|URLConnection|Thread\.|new Random|ThreadLocalRandom|Math\.random|(LocalDate|LocalDateTime|Instant|ZonedDateTime)\.now|UUID\.randomUUID)/g;
const strip = (l) => l.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])+'/g, "' '").replace(/\/\/.*$/, '');

function javadocBefore(lines, i) {
  let j = i - 1;
  while (j >= 0 && (lines[j].trim().startsWith('@') || lines[j].trim() === '')) j--;
  if (j < 0 || !lines[j].trim().endsWith('*/')) return '';
  const end = j;
  while (j >= 0 && !lines[j].includes('/**')) j--;
  if (j < 0) return '';
  return lines.slice(j, end + 1).map((l) => l.replace(/^\s*\/?\*+\/?\s?/, '').replace(/\*\/\s*$/, '')).join('\n').replace(/\{@(code|link|linkplain) ([^}]*)\}/g, '$2').trim();
}

function splitTop(params) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of params) {
    if (ch === '<' || ch === '(') depth++;
    if (ch === '>' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function scanJavaFile(repo, root, file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.length > 400000) return [];
  const pkg = (src.match(/^\s*package\s+([\w.]+)\s*;/m) || [])[1] || '';
  const lines = src.split('\n');
  const rel = path.relative(repo, file).split(path.sep).join('/');
  const out = [];
  let depth = 0, inComment = false, cls = null, clsPublic = false, clsKind = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (inComment) { if (!line.includes('*/')) continue; line = line.slice(line.indexOf('*/') + 2); inComment = false; }
    line = line.replace(/\/\*.*?\*\//g, '');
    if (line.includes('/*')) { inComment = true; line = line.slice(0, line.indexOf('/*')); }
    const t = line.trim();
    const before = depth;
    if (before === 0) {
      const m = t.match(/^(?:@\w+(?:\([^)]*\))?\s+)*((?:public|abstract|final|sealed|non-sealed|static|strictfp)\s+)*(class|record|enum|interface)\s+(\w+)/);
      if (m) { cls = m[3]; clsKind = m[2]; clsPublic = /\bpublic\b/.test(t); }
    }
    if (before === 1 && cls && clsPublic) {
      const isInterface = clsKind === 'interface';
      const m = t.match(/^(?:@\w+(?:\([^)]*\))?\s+)*((?:public|protected|private|static|final|synchronized|default|abstract|native|strictfp)\s+)*(?:<[^>]+>\s+)?([\w.$<>[\],?\s]+?)\s+(\w+)\s*\(/);
      if (m && !/^(return|new|else|throw)$/.test(m[2]) && m[3] !== cls) {
        const mods = m[1] || '';
        const isPublic = /\bpublic\b/.test(t) || (isInterface && /\b(default|static)\b/.test(mods));
        if (isPublic && !/\babstract\b|\bnative\b/.test(mods)) {
          let sig = '', j = i;
          for (; j < Math.min(lines.length, i + 20); j++) { sig += ' ' + lines[j].trim(); if (/[{;]/.test(strip(lines[j]))) break; }
          if (sig.includes('{')) {
            let d = 0, seen = false, end = i;
            for (let k = i; k < Math.min(lines.length, i + 800); k++) {
              for (const ch of strip(lines[k])) { if (ch === '{') { d++; seen = true; } else if (ch === '}') d--; }
              if (seen && d <= 0) { end = k; break; }
            }
            const params = (sig.match(/\(([\s\S]*?)\)\s*(throws [\w.,\s]+)?\{/) || [, ''])[1];
            const name = m[3];
            const isStatic = /\bstatic\b/.test(mods);
            const body = lines.slice(i, end + 1).join('\n');
            if (!out.some((x) => x.name === name)) {
              out.push({
                file: rel, module: pkg ? `${pkg}.${cls}` : cls, pkg, className: cls, name, qualname: `${cls}.${name}`, owner: cls, static: isStatic,
                line: i + 1, loc: end - i + 1, signature: `(${params.replace(/\s+/g, ' ').trim()}): ${m[2].trim()}`,
                nArgs: splitTop(params).length + (isStatic ? 0 : 1), doc: javadocBefore(lines, i).slice(0, 600),
                impure: [...new Set([...body.matchAll(IMPURE)].map((x) => x[1].replace(/[.(]$/, '')))], annotated: true, async: /CompletableFuture|Future</.test(m[2]), decorators: [],
              });
            }
          }
        }
      }
    }
    for (const ch of strip(line)) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0 && before > 0) cls = cls && before === 1 ? null : cls;
  }
  return out;
}

// --- running JUnit through the console launcher ---

const xmlText = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function sourceLine(file, line) {
  try { return fs.readFileSync(file, 'utf8').split('\n')[line - 1] || ''; } catch { return ''; }
}

/**
 * Turn a Java stack trace into counterhound's error shape. `resolve(className, fileName)` maps a frame
 * to a source path, or null for JDK and library frames, which are dropped: a JDK method that throws on
 * the project's behalf is attributed to the project frame that called it.
 */
export function parseJavaTrace(text, resolve) {
  const out = { type: 'java.lang.Throwable', message: '', notes: [], frames: [], example: null };
  const smallest = text.match(/Smallest found falsifying value\(s\) :-\n(.*)/);
  if (smallest) out.example = `Failing test case: ${smallest[1].trim()}`;
  // QuickTheories wraps the property's own exception after "Cause was :-"
  let trace = text;
  const cause = text.indexOf('Cause was :-\n');
  if (cause >= 0) trace = text.slice(cause + 'Cause was :-\n'.length);
  trace = trace.split(/\n\s*(?:Caused by|Suppressed): /)[0]; // Suppressed: is tab-indented
  const head = trace.split(/\n\s*at /)[0];
  const m = head.trim().match(/^([\w$]+(?:\.[\w$]+)*)(?::\s?([\s\S]*))?$/);
  if (m) { out.type = m[1]; out.message = (m[2] || '').trim(); } else out.message = head.trim();
  if (cause < 0 && /^Property falsified/.test(out.message)) out.message = out.message.split('\n')[0];
  if (/^(org\.opentest4j\.AssertionFailedError|java\.lang\.AssertionError|org\.opentest4j\.MultipleFailuresError)$/.test(out.type)) out.type = 'AssertionError';
  for (const f of trace.matchAll(/^\s*at (?:[\w.$/@]+\/)?([\w.$]+)\.([\w$<>]+)\(([\w$]+\.java):(\d+)\)/gm)) {
    const file = resolve(f[1], f[3]);
    if (file) out.frames.push({ file, line: +f[4], func: `${f[1].split('.').pop()}.${f[2]}`, code: sourceLine(file, +f[4]).trim().slice(0, 300) });
  }
  out.frames.reverse(); // outermost first, deepest last
  out.message = out.message.slice(0, 2000);
  return out;
}

export function parseJUnitXml(xml, resolve) {
  const tests = [];
  for (const m of xml.matchAll(/<testcase name="([^"]*)" classname="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const name = xmlText(m[1]).replace(/\(.*\)$/, '');
    const body = m[4] || '';
    const fail = body.match(/<(failure|error)\b[^>]*?(?:\/>|>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/\1>)/);
    const outcome = fail ? 'failed' : /<skipped/.test(body) ? 'skipped' : 'passed';
    const text = fail ? xmlText(fail[2] || (body.match(/message="([^"]*)"/) || [, ''])[1]) : '';
    tests.push({ id: `${xmlText(m[2])}#${name}`, name, outcome, error: fail ? parseJavaTrace(text, resolve) : null, longrepr: fail ? text.slice(0, 6000) : null });
  }
  return tests;
}

function testClass(file) {
  const src = fs.readFileSync(file, 'utf8');
  const pkg = (src.match(/^\s*package\s+([\w.]+)\s*;/m) || [])[1];
  const cls = (src.match(/^\s*(?:public\s+|final\s+)*class\s+(\w+)/m) || [])[1] || path.basename(file, '.java');
  return pkg ? `${pkg}.${cls}` : cls;
}

export const java = {
  id: 'java',
  name: 'Java',
  framework: 'QuickTheories',
  ext: '.java',

  detect(repo) {
    return ['pom.xml', 'build.gradle', 'build.gradle.kts'].some((f) => fs.existsSync(path.join(repo, f))) && sourceRoots(repo).some((r) => r !== repo);
  },

  check(repo, cfg = {}) {
    const r = sh('javac', ['-version'], { cwd: repo });
    if (r.code !== 0) return { ok: false, problem: 'javac was not found. Install a JDK 21+ (for example from https://adoptium.net)' };
    const v = (r.stdout + r.stderr).match(/javac (\d+)/);
    if (v && +v[1] < 21) return { ok: false, problem: `javac ${v[1]} is too old; counterhound needs JDK 21+` };
    try { ensureJars(); } catch (e) { return { ok: false, problem: e.message }; }
    return { ok: true, info: `${(r.stdout + r.stderr).split('\n').find((l) => /^javac /.test(l)) || 'javac'}, JUnit 5 + QuickTheories (counterhound cache)` };
  },

  prepare(repo, workRoot, cfg) { ensureJars(); ensureBuilt(repo, cfg); },

  listTargets(repo, cfg, only = []) {
    const onlyAbs = only.map((o) => path.resolve(repo, o));
    const out = [];
    for (const root of sourceRoots(repo)) {
      for (const f of javaFiles(root)) {
        if (onlyAbs.length && !onlyAbs.some((o) => f === o || f.startsWith(o + path.sep))) continue;
        out.push(...scanJavaFile(repo, root, f));
      }
    }
    return out.map((t) => ({ ...t, lang: 'java', id: `${t.module}.${t.name}` }));
  },

  importHint(target) {
    const call = target.static ? `${target.className}.${target.name}(...)` : `new ${target.className}(...).${target.name}(...) (or however instances are normally obtained)`;
    return `package ${target.pkg || '(default package)'}; call ${call}`;
  },

  needsTs() { return false; },

  files() { return { props: 'PhPropsTest.java', repro: 'Repro<Name>Test.java' }; },

  async runTests(repo, cfg, selectors, { timeoutMs = 300000, name } = {}) {
    const files = selectors.map((s) => path.resolve(s)).filter((f) => fs.existsSync(f));
    if (!files.length) return { code: 1, timedOut: false, ms: 0, tests: [], output: `no such file: ${selectors.join(' ')}` };
    const jars = ensureJars();
    let built;
    try { built = ensureBuilt(repo, cfg); } catch (e) {
      return { code: 1, timedOut: false, ms: 0, tests: [{ id: 'build', name: 'build', outcome: 'error', error: null, longrepr: e.message }], output: e.message };
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-java-'));
    const tcls = path.join(tmp, 'classes');
    const cp = [built.classes, built.deps, ...jars].filter(Boolean).join(path.delimiter);
    const c = await run('javac', ['-encoding', 'UTF-8', '-nowarn', '-proc:none', '-d', tcls, '-cp', cp, ...files], { cwd: repo, timeoutMs });
    if (c.code !== 0) {
      fs.rmSync(tmp, { recursive: true, force: true });
      const msg = (c.stdout + c.stderr).split('\n').filter((l) => !/^Picked up JAVA_TOOL_OPTIONS/.test(l)).join('\n').trim();
      return { code: c.code, timedOut: c.timedOut, ms: c.ms, tests: [{ id: 'build', name: 'build', outcome: 'error', error: null, longrepr: msg.slice(0, 6000) }], output: msg };
    }
    const workdirs = new Map(files.map((f) => [path.basename(f), f]));
    const resolve = (className, fileName) => {
      if (workdirs.has(fileName)) return workdirs.get(fileName);
      const pkgPath = className.replace(/\$.*$/, '').split('.').slice(0, -1).join('/');
      for (const root of built.roots) {
        const p = path.join(root, pkgPath, fileName);
        if (fs.existsSync(p)) return p;
      }
      return null;
    };
    const selects = name ? files.map((f) => ['--select-method', `${testClass(f)}#${name}`]).flat() : files.flatMap((f) => ['--select-class', testClass(f)]);
    const reports = path.join(tmp, 'reports');
    const args = [...(cfg.jvmArgs || []), '-jar', LAUNCHER, 'execute', '--disable-banner', '--details=none', '--disable-ansi-colors',
      '--class-path', [tcls, cp].join(path.delimiter), '--reports-dir', reports, ...selects];
    const r = await run('java', args, { cwd: repo, env: { ...process.env, ...(cfg.env || {}) }, timeoutMs });
    let tests = [];
    for (const f of ['TEST-junit-jupiter.xml']) {
      const p = path.join(reports, f);
      if (fs.existsSync(p)) tests = tests.concat(parseJUnitXml(fs.readFileSync(p, 'utf8'), resolve));
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (name) tests = tests.filter((t) => t.name === name);
    return { code: r.code, timedOut: r.timedOut, ms: r.ms + c.ms, tests, output: `${r.stdout}\n${r.stderr}` };
  },

  suite(repo) {
    if (fs.existsSync(path.join(repo, 'pom.xml'))) return { cmd: fs.existsSync(path.join(repo, 'mvnw')) ? './mvnw' : 'mvn', args: ['-q', '-B', 'test'] };
    if (['build.gradle', 'build.gradle.kts'].some((f) => fs.existsSync(path.join(repo, f)))) return { cmd: fs.existsSync(path.join(repo, 'gradlew')) ? './gradlew' : 'gradle', args: ['-q', 'test'] };
    return null;
  },

  testErrorTypes: ['java.lang.NoClassDefFoundError', 'java.lang.NoSuchMethodError', 'java.lang.NoSuchFieldError', 'java.lang.ClassNotFoundException', /^org\.quicktheories\./, /^org\.junit\./],

  isExplicitRaise(frame) { return /(^|[;{)]\s*)throw\s+(new\s+)?[\w$]/.test(frame?.code || ''); },
};
