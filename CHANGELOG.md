# Changelog

All notable changes to Aris Code are documented here.

---

## [0.1.0] — 2026-05-08

### Initial release — MVP

First working version of the extension. Generates code and scans it for
security vulnerabilities without leaving VSCode.

### Added

**Commands**
- `arisCode.generate` — generates code from a prompt via Ollama or OpenAI,
  scans it automatically, shows results in the Output Channel, and inserts
  the code at the cursor position (or copies to clipboard if no editor is open).
  Keyboard shortcut: `Ctrl+Shift+Alt+G`.
- `arisCode.scanFile` — scans the currently open file for vulnerabilities and
  hardcoded secrets. Results appear as inline diagnostics (squiggles) and in
  the Problems panel.

**Code generation**
- Ollama integration (default) — local LLM, no API key required. Tested with
  `llama2` and `mistral`. System prompt instructs the model to avoid OWASP
  Top 10 vulnerabilities.
- OpenAI integration (optional) — uses `gpt-4o-mini`. Activated by setting
  `arisCode.llmProvider` to `openai` and providing an API key.

**Security scanning**
- Semgrep SAST with fallback chain: API (if token configured) → local CLI
  (if installed) → empty result. Scans for SQL injection, XSS, command
  injection, insecure deserialization, and other OWASP Top 10 patterns.
- Secret detection with fallback chain: truffleHog CLI (if installed) →
  regex patterns. Covers AWS access keys, OpenAI keys, GitHub tokens,
  private keys, hardcoded passwords, database URLs, and generic API keys.
- All scanners fail silently and return an empty array — the user always
  receives their generated code regardless of scanner availability.

**VSCode integration**
- Output Channel ("Aris Code") — displays generated code and scan results
  with severity levels (`[CRITICAL]`, `[HIGH]`, `[MEDIUM]`, `[SECRET]`).
- Diagnostic Collection — inline squiggles and Problems panel entries for
  file scans. Critical and high vulnerabilities show as errors, others as
  warnings.
- Progress notifications with spinner during generation and scanning.
- Input validation — prompts must be between 10 and 1000 characters.
- Configuration via VSCode Settings UI under "Aris Code".

**Configuration settings** (`arisCode.*`)
- `llmProvider` — `ollama` (default) or `openai`
- `ollamaHost` — Ollama server URL (default: `http://localhost:11434`)
- `ollamaModel` — model name (default: `llama2`)
- `temperature` — generation temperature 0–2 (default: `0.7`)
- `openaiApiKey` — OpenAI API key (only used when provider is `openai`)
- `semgrepApiToken` — Semgrep API token (optional, falls back to CLI)

**Project setup**
- TypeScript project with strict mode
- esbuild for production bundling (`dist/extension.js`)
- Jest with ts-jest for unit testing (13 tests, >80% coverage on services)
- ESLint + Prettier configuration
- VSCode debug configuration (F5 → Extension Development Host)
- `.env.example` with all configurable environment variables

### Architecture decisions

- No Webview — all UI uses native VSCode APIs (OutputChannel,
  DiagnosticCollection, showInputBox, withProgress). Simpler, faster to
  ship, easier to maintain.
- Services contain no VSCode API calls except `workspace.getConfiguration`.
  This keeps them unit-testable without complex mocks.
- All scanners run in parallel via `Promise.all` to minimize wait time.
- Fallback chains on every scanner — the extension degrades gracefully when
  external tools are not installed.

### Not included (planned for v0.2.0)

- Dependency audit (`npm audit`)
- Generation history with sidebar tree view
- Ollama model selector (QuickPick)
- Webview dashboard (only if native APIs prove insufficient)

---

[0.1.0]: https://github.com/Naren15022005/ArisSecure-ExtensionVS/releases/tag/v0.1.0
