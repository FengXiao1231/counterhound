# Security

proofhound runs an AI agent against your source tree, so the two things worth caring about are what the agent can touch and where your key goes.

- **Claude Code backend:** the hunter runs with `--permission-mode dontAsk` and an allowlist; it can only write under `.proofhound/runs/` and only run tests through proofhound's own runner. The fixer edits a throwaway copy in the system temp dir.
- **Codex backend:** Codex has no per-tool allowlist, so it runs with `--sandbox workspace-write` and can edit any file in the project. Run it on a clean checkout.
- **Keys:** proofhound never reads or stores your API key. The agent CLI uses its own login. In GitHub Actions the key comes from the calling repository's own Secrets; never switch the workflow to `pull_request_target`.
- **Your code leaves the machine** only through the agent CLI, to the provider you chose. Nothing is sent anywhere else.

To report a vulnerability in proofhound itself, open a private security advisory on GitHub (Security → Report a vulnerability) instead of a public issue.
