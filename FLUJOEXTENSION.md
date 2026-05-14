# FLUJOEXTENSION.md

Documento vivo del flujo de desarrollo de Aris Code (extensión VSCode).
Se actualiza a medida que avanza la implementación.

---

## Estado Actual

| Fase | Estado | Descripcion |
|---|---|---|
| 0. Scaffold & Config | ✅ Completo | package.json, tsconfig, jest.config.js, eslint, prettier |
| 1. Core Services | ✅ Completo | CodeGen, Security, Secrets |
| 2. Extension Entry Point | ✅ Completo | 4 comandos con VSCode APIs nativas |
| 3. Tests | ✅ Completo | 24 tests, 0 errores TypeScript |
| 4. Sidebar + Quick Action | ✅ Completo | IssueTreeProvider, Activity Bar, botón en editor title |
| 5. Publish Prep | ⏳ Pendiente | Icon, README marketplace, vsce publish |

---

## Requisitos Previos

| Requerimiento | Minimo | Verificar |
|---|---|---|
| Node.js | 18.0.0 | `node --version` |
| npm | 9.0.0 | `npm --version` |
| VSCode | 1.60.0 | Help → About |
| Git | cualquiera | `git --version` |
| Ollama | latest | `ollama --version` |
| Semgrep | latest | `semgrep --version` (opcional) |
| truffleHog | latest | `truffleHog --help` (opcional) |

### Setup inicial

```bash
git clone https://github.com/Naren15022005/aris-code-extension.git
cd aris-code-extension
npm install
npm run build
npm test        # deben pasar los 24 tests
npm run dev     # abre VSCode con la extension cargada → F5 para debug
```

---

## Decisión de Arquitectura: Sin Webview

Regla: usar VSCode APIs nativas primero. El Webview solo se justifica si las APIs nativas no pueden cubrir la necesidad.

| Necesidad | API nativa |
|---|---|
| Input del usuario | `vscode.window.showInputBox` |
| Mostrar codigo y resultados | `vscode.window.createOutputChannel` |
| Marcar vulnerabilidades inline | `vscode.languages.createDiagnosticCollection` |
| Configuracion | `vscode.workspace.getConfiguration` |
| Historial / lista de issues | `TreeDataProvider` + Activity Bar sidebar ✅ |

Resultado: ~350 lineas de codigo de extension + 80 lineas de TreeProvider vs ~800 con Webview.

---

## Esqueleto de extension.ts (v0.2.0)

```typescript
import * as vscode from 'vscode';
import { CodeGenerationService } from './services/CodeGenerationService';
import { SecurityScanningService } from './services/SecurityScanningService';
import { SecretDetectionService } from './services/SecretDetectionService';
import { IssueTreeProvider } from './views/IssueTreeProvider';

let outputChannel: vscode.OutputChannel;
let treeProvider: IssueTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Aris Code');
  treeProvider = new IssueTreeProvider();
  vscode.window.registerTreeDataProvider('arisCode-issues', treeProvider);

  context.subscriptions.push(
    diagnostics,
    vscode.commands.registerCommand('arisCode.generate', generateCommand),
    vscode.commands.registerCommand('arisCode.scanFile', scanFileCommand),
    vscode.commands.registerCommand('arisCode.quickScan', quickScanCommand),
    vscode.commands.registerCommand('arisCode.goToIssue', goToIssueCommand)
  );
}
```

---

## Flujo: `arisCode.generate`

Atajo: `Ctrl+Shift+Alt+G` o palette → "Aris: Generate Secure Code"

```
generateCommand()
        |
showInputBox()
  - title: "Aris Code - Generate Secure Code"
  - validateInput: min 10, max 1000 chars
  - si cancela: return
        |
withProgress() [spinner en notificacion]
        |
  [1] CodeGenerationService.generate(prompt)
        |-- llmProvider = 'ollama' --> POST localhost:11434/api/generate
        `-- llmProvider = 'openai' --> POST api.openai.com/v1/chat/completions
        |
  [2] Promise.all (paralelo)
        |-- SecurityScanningService.scan(code)
        `-- SecretDetectionService.detect(code)
        |
writeResultsToOutput(code, vulns, secrets) --> OutputChannel
treeProvider.setIssues(...)               --> Sidebar Activity Bar
insertOrCopy(code)
  |-- editor activo: inserta en posicion del cursor
  `-- sin editor:   copia al clipboard + notification
```

---

## Flujo: `arisCode.scanFile`

Atajo: `Ctrl+Shift+Alt+S` o palette → "Aris: Scan Current File"

```
scanFileCommand()
        |
activeTextEditor
  `-- si no hay editor: showWarningMessage() + return
        |
editor.document.getText()
        |
Promise.all (paralelo)
  |-- SecurityScanningService.scan(code)
  `-- SecretDetectionService.detect(code)
        |
applyDiagnostics(doc, vulns, secrets)
  - critical/high  --> DiagnosticSeverity.Error
  - medium/low     --> DiagnosticSeverity.Warning
  - secrets        --> DiagnosticSeverity.Error (siempre critical)
  resultado: squiggles en editor + entradas en panel Problems
        |
treeProvider.setIssues(...) --> Sidebar se actualiza
        |
showScanSummary(vulns, secrets)
  |-- 0 issues: showInformationMessage
  `-- N issues: showWarningMessage "Check sidebar"
```

---

## Flujo: `arisCode.quickScan`

Atajo: `Ctrl+Shift+Alt+Q` | Boton: icono 🛡️ en la barra superior derecha del editor

```
quickScanCommand()
        |
scanFileCommand()  [mismo flujo que arriba]
        |
executeCommand('arisCode-issues.focus')  --> abre/enfoca el sidebar
```

---

## Flujo: `arisCode.goToIssue`

Disparado al hacer click en un item del sidebar.

```
goToIssueCommand(line: number)
        |
activeTextEditor → Position(line - 1, 0)
        |
editor.selection = nueva seleccion
editor.revealRange(...)  --> InCenter
```

---

## Scanner Fallback Chain

```
SecurityScanningService.scan(code)
  1. Semgrep API   si arisCode.semgrepApiToken esta configurado
                   POST https://api.semgrep.dev/api/validate
                   en error: continua
  2. semgrep CLI   si esta instalado en PATH
                   execAsync('semgrep --json --config auto <tmpfile>')
                   en error: continua
  3. []            retorna array vacio, nunca bloquea al usuario

SecretDetectionService.detect(code)
  1. truffleHog CLI   si esta instalado en PATH
                      execAsync('truffleHog filesystem <tmpfile> --json')
                      en error: continua
  2. Regex patterns   siempre disponible como fallback
                      cubre: AWS_ACCESS_KEY, OPENAI_API_KEY, GITHUB_TOKEN,
                             PRIVATE_KEY, PASSWORD, DB_URL, GENERIC_SECRET
```

---

## Estructura de Archivos (v0.2.0)

```
src/
├─ extension.ts                     entry point — activacion, 4 comandos, todas las VSCode API calls
├─ services/
│  ├─ CodeGenerationService.ts      Ollama + OpenAI
│  ├─ SecurityScanningService.ts    Semgrep API → CLI → []
│  └─ SecretDetectionService.ts     truffleHog CLI → regex patterns
├─ views/
│  └─ IssueTreeProvider.ts          TreeDataProvider para Activity Bar sidebar  ← NUEVO
├─ types/
│  └─ index.ts                      re-exports Vulnerability, Secret + ScanResult
└─ utils/
   ├─ validation.ts                 validatePrompt() — min 10, max 1000 chars
   └─ logger.ts                     output channel wrapper

tests/
├─ __mocks__/
│  └─ vscode.ts                     mock de VSCode para Jest (incluye TreeItem, EventEmitter, etc.)
└─ unit/
   ├─ validation.test.ts            5 tests
   ├─ SecretDetectionService.test.ts   6 tests
   ├─ SecurityScanningService.test.ts  2 tests
   └─ IssueTreeProvider.test.ts       11 tests  ← NUEVO
```

---

## Dependencias

```
dependencies:
  axios: ^1.6.0                 HTTP para Ollama y Semgrep API

devDependencies:
  @types/node: ^20.0.0
  @types/vscode: ^1.60.0
  typescript: ^5.0.0
  eslint: ^8.0.0
  prettier: ^3.0.0
  jest: ^29.0.0
  ts-jest: ^29.0.0
  esbuild: ^0.19.0
  @vscode/vsce: ^2.22.0
  rimraf: ^5.0.5

scripts clave:
  dev:          esbuild --sourcemap --watch
  build:        esbuild → dist/extension.js (bundle, sin vscode)
  test:         jest  (24 tests)
  package:      vsce package → .vsix
  publish:      vsce publish
```

---

## Configuracion VSCode (`arisCode.*`)

| Setting | Default | Descripcion |
|---|---|---|
| `llmProvider` | `ollama` | Proveedor LLM: `ollama` o `openai` |
| `ollamaHost` | `http://localhost:11434` | URL del servidor Ollama |
| `ollamaModel` | `llama2` | Nombre del modelo |
| `temperature` | `0.7` | Temperatura de generacion (0–2) |
| `openaiApiKey` | `""` | API Key de OpenAI (solo si provider = openai) |
| `semgrepApiToken` | `""` | Token de semgrep.dev (opcional) |

---

## Comandos Registrados (v0.2.0)

| Command ID | Titulo en palette | Atajo |
|---|---|---|
| `arisCode.generate` | Aris: Generate Secure Code | `Ctrl+Shift+Alt+G` |
| `arisCode.scanFile` | Aris: Scan Current File | `Ctrl+Shift+Alt+S` |
| `arisCode.quickScan` | Aris: Quick Scan | `Ctrl+Shift+Alt+Q` + boton 🛡️ |
| `arisCode.goToIssue` | Aris: Go To Issue | click en sidebar |

---

## UI: Activity Bar Sidebar (v0.2.0)

```
Activity Bar (izquierda):
└─ 🛡️ Aris Code  (container: arisCode-explorer)
   └─ Security Issues  (view: arisCode-issues)
      ├─ 🔴 Critical (N)
      │  ├─ [L3] AWS_ACCESS_KEY  — Hardcoded secret — move to env var
      │  └─ [L12] sql-injection  — SQL injection risk
      ├─ 🟠 High (N)
      ├─ 🟡 Medium (N)
      └─ 🔵 Low (N)

Editor Title Bar (superior derecha):
└─ 🛡️ [Quick Scan]  (cuando hay editor activo)
```

Comportamiento:
- Click en item del sidebar → navega a la linea del issue en el editor
- Quick Scan → escanea archivo activo + abre sidebar automaticamente
- Sidebar se actualiza tras cada scan (generate o scanFile)

---

## Timeline

### Semanas 1-2: Core + Entry Point — COMPLETO

```
Services:
  CodeGenerationService  — Ollama + OpenAI, timeout 60s, system prompt de seguridad
  SecurityScanningService — Semgrep API → CLI → []
  SecretDetectionService  — truffleHog → regex (7 patrones)

Extension:
  generateCommand  — showInputBox → generate → scan paralelo → OutputChannel → insert/copy
  scanFileCommand  — getText → scan paralelo → DiagnosticCollection → summary

Tests: 13 passing, 0 errores TypeScript, coverage >80% en servicios
```

### Semana 3: Sidebar + Quick Action — COMPLETO

```
v0.2.0:
  IssueTreeProvider — TreeDataProvider con agrupacion por severidad
  Activity Bar container (arisCode-explorer) + view (arisCode-issues)
  quickScan command — escanea + abre sidebar
  goToIssue command — navegacion directa al issue desde sidebar
  editor/title menu entry — boton 🛡️ en barra superior del editor
  Keybindings: Ctrl+Shift+Alt+S (scan) y Ctrl+Shift+Alt+Q (quickScan)

Tests: 24 passing (13 anteriores + 11 nuevos de IssueTreeProvider)
Build: dist/extension.js 485kb
Package: aris-code-0.2.0.vsix generado
```

### Semana 4: Polish & Publish Prep — PROXIMO

```
[ ] assets/icon.png           128x128 PNG, fondo oscuro con icono de candado
[ ] .vscodeignore             excluir node_modules, tests, src del .vsix
[ ] repository en package.json
[ ] LICENSE (MIT)
[ ] README.md para Marketplace
[ ] vsce publish
[ ] GitHub release v0.2.0 con .vsix adjunto
```

---

## Fase 3 (post-traction)

| Feature | Implementacion |
|---|---|
| npm audit integrado | `DependencyAuditService` + resultado en OutputChannel y sidebar |
| Re-escaneo automatico al guardar | `vscode.workspace.onDidSaveTextDocument` |
| Selector de modelo Ollama | `vscode.window.showQuickPick` con modelos disponibles |
| Apply Fix desde sidebar | `vscode.WorkspaceEdit` aplicado desde IssueItem.command |

---

*Ultima actualizacion: v0.2.0 completo — Sidebar + Quick Action + 24 tests pasando*
