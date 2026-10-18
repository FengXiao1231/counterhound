# Contributing

```bash
git clone https://github.com/FengXiao1231/counterhound
cd counterhound
npm test        # unit + e2e against the planted-bug fixtures, no AI calls
```

The e2e tests drive a fake agent (`test/helpers/`) against `test/fixtures/`, so they are deterministic and free. Tests that need `go`, `cargo`, a JDK, `pip install pytest hypothesis` or `pip install fastapi httpx` skip when the tool is missing.

- A new language is one adapter in `src/lang/` plus a fixture with planted bugs and a decoy (a documented error that must *not* be reported). Look at `src/lang/go.js` for the smallest complete one.
- Keep the funnel one-directional: a stage may drop or merge findings, never add them.
- Zero runtime dependencies. If something needs a package, fetch it into the cache at run time like fast-check and QuickTheories are.
- Update both `README.md` and `README.zh-CN.md` when options or output change.
