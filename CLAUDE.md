# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aris Code** is a VSCode extension that generates code via Ollama/OpenAI and immediately scans it for:
- **SAST**: Semgrep (OWASP Top 10 patterns)
- **Secrets**: truffleHog or regex patterns (API keys, passwords, DB URLs)

Results appear in the **Output Channel** ("Aris Code") and inline **Diagnostics** — no custom UI, pure VSCode APIs.

## Quick Start

```bash
npm install
# Press F5 in VSCode to open Extension Development Host
```

**External dependencies** (optional — extension degrades gracefully without them):
```bash
ollama serve          # LLM code generation (default provider)
pip install semgrep   # SAST scanning (falls back to pattern-only if missing)
pip install truffleHog  # Secret detection (falls back to regex patterns)
```

Copy `.env.example` → `.env` and set `SEMGREP_API_TOKEN` if using the API.

## Commands

```bash
npm run compile       # TypeScript → out/
npm run watch         # Watch + recompile on save
npm run build         # Production bundle (esbuild, minified)
npm test              # Jest unit tests
npm test -- --watch   # Watch mode
npm test -- MyFile.test.ts   # Single file
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier
npm run package       # → .vsix file (vsce)
vsce publish          # Publish to Marketplace
```

Press **F5** in VSCode → Extension Development Host → set breakpoints → F10/F11 to step.

## Architecture

No Webview. Everything uses native VSCode APIs.

```
User runs command (Ctrl+Shift+P)
        ↓
extension.ts  (activate → registerCommand)
        ↓
  "arisCode.generate"           "arisCode.scan"
        │                             │
  showInputBox()              activeTextEditor.getText()
        │                             │
  CodeGenerationService         SecurityScanningService
  (Ollama / OpenAI)             SecretDetectionService
        │                             │
  SecurityScanningService       applyDiagnostics()
  SecretDetectionService              │
        │                    vscode.languages (inline squiggles)
  showResults() → OutputChannel
  insertOrCopyCode() → editor / clipboard
```

### Files

```
src/
├─ extension.ts                  # Entry point — activation, both commands, all VSCode API calls
├─ services/
│  ├─ CodeGenerationService.ts   # Ollama + OpenAI generation
│  ├─ SecurityScanningService.ts # Semgrep API → CLI → []
│  └─ SecretDetectionService.ts  # truffleHog CLI → regex patterns
├─ types/index.ts                # Re-exports Vulnerability + Secret, ScanResult
└─ utils/
   ├─ apiClient.ts               # (unused post-rewrite, can be removed)
   ├─ validation.ts              # validatePrompt (min 10, max 1000 chars)
   └─ logger.ts                  # Output channel wrapper

tests/
├─ __mocks__/vscode.ts           # Minimal VSCode mock for Jest
└─ unit/
   ├─ validation.test.ts
   ├─ SecretDetectionService.test.ts
   └─ SecurityScanningService.test.ts
```

**Rule:** All VSCode API calls live in `extension.ts`. Services are pure logic with no VSCode imports except `workspace.getConfiguration`.

### Scanner fallback chain

```
SecurityScanningService.scan(code)
  1. Semgrep API  (if SEMGREP_API_TOKEN configured)
  2. semgrep CLI  (if installed locally)
  3. []           (silent fail — never blocks the user)

SecretDetectionService.detect(code)
  1. truffleHog CLI  (if installed)
  2. regex patterns  (always available as fallback)
```

### Settings (VSCode Configuration)

All settings live under `arisCode.*` in VSCode settings — no `.env` at runtime.

| Setting | Default | Description |
|---|---|---|
| `arisCode.llmProvider` | `ollama` | `ollama` or `openai` |
| `arisCode.ollamaHost` | `http://localhost:11434` | Ollama server URL |
| `arisCode.ollamaModel` | `llama2` | Model name |
| `arisCode.temperature` | `0.7` | Generation temperature |
| `arisCode.openaiApiKey` | `""` | OpenAI key (only if provider = openai) |
| `arisCode.semgrepApiToken` | `""` | Semgrep API token (optional) |

## Testing

- All external APIs (Ollama, Semgrep, truffleHog) are mocked in unit tests
- `tests/__mocks__/vscode.ts` provides the global VSCode mock
- Services return `[]` on failure — tests verify this graceful degradation
- `extension.ts` is excluded from coverage (VSCode integration, tested via F5)

## Adding Features

**New scanner/provider** → new `src/services/MyService.ts` + call from `extension.ts`

**New command** → `registerCommand` in `extension.ts` + add to `package.json` `contributes.commands`

**Never** add a Webview unless VSCode's native APIs (InputBox, QuickPick, OutputChannel, Diagnostics, TreeView) genuinely cannot do the job. Each native API saves ~200 lines of HTML/JS/CSS.
