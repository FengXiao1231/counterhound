# Changelog

## 0.1.0 (2026-10-23)

First public release. counterhound is an AI bug hunter whose every report is a failing test you can run.

**What it does**
- Points an agent (Claude Code or Codex) at your code, has it infer properties and write property-based tests (Hypothesis, fast-check, rapid, proptest, QuickTheories), then replays every failure as a deterministic repro, classifies it, dedups it and has an independent reviewer try to refute it. Only bugs that survive all of that are reported.
- Python, JS/TS, Go, Rust and Java. Stateful (model-based) testing for classes, `--api` for HTTP routes, `--fix` to write and verify a patch, `--diff` for changed code only, a GitHub Action (`FengXiao1231/counterhound@v0`) and an HTML report.

**Track record so far**
- 64 confirmed bugs across 98 open-source libraries and apps, every one hand-checked, none wrong (see SHOWCASE.md).
- 11 reported upstream; 3 already fixed by the maintainers (query-string, qs, parse) and 3 more have fixes under review.

**Install**
```
npx counterhound
```
Node 18+, zero dependencies.
