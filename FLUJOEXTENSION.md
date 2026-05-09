# FLUJOEXTENSION.md

Documento vivo del flujo de desarrollo de Aris Code (extensión VSCode).
Se actualiza a medida que avanza la implementación.

---

## Estado Actual

| Fase | Estado | Descripcion |
|---|---|---|
| 0. Scaffold & Config | ✅ Completo | package.json, tsconfig, jest.config.js, eslint, prettier |
| 1. Core Services | ✅ Completo | CodeGen, Security, Secrets |
| 2. Extension Entry Point | ✅ Completo | 2 comandos con VSCode APIs nativas |
| 3. Tests | ✅ Completo | 13 tests, 0 errores TypeScript |
| 4. Webview | ❌ Descartado | Reemplazado por Output Channel + Diagnostics |
| 5. Publish Prep | ⏳ Pendiente | Icon, README marketplace, vsce |

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
npm test        # deben pasar los 13 tests
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
| Historial (fase 2) | `TreeDataProvider` |

Resultado: ~200 lineas vs ~800 con Webview. MVP completado en 2 semanas.

---

## Esqueleto de extension.ts

El entry point sigue esta estructura. La implementacion completa esta en `src/extension.ts`.

```typescript
import * as vscode from 'vscode';
import { CodeGenerationService } from './services/CodeGenerationService';
import { SecurityScanningService } from './services/SecurityScanningService';
import { SecretDetectionService } from './services/SecretDetectionService';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Aris Code');

  const codeGen = new CodeGenerationService();
  const security = new SecurityScanningService();
  const secrets = new SecretDetectionService();

  context.subscriptions.push(
    vscode.commands.registerCommand('arisCode.generate', () =>
      generateCommand(codeGen, security, secrets)
    ),
    vscode.commands.registerCommand('arisCode.scanFile', () =>
      scanFileCommand(security, secrets)
    )
  );

  outputChannel.appendLine('Aris Code activated.');
}

export function deactivate(): void {
  outputChannel?.dispose();
}

// generateCommand: showInputBox → generate → scan → writeResultsToOutput → insertOrCopy
// scanFileCommand: activeTextEditor → scan → applyDiagnostics → showScanSummary
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
writeResultsToOutput(code, vulns, secrets)
  --> OutputChannel "Aris Code":
        ==================================================
        Aris Code - Scan Results
        ==================================================
        --- Generated Code ---
        <codigo generado>
        --- Security Scan ---
        [CRITICAL] Line 5: SQL injection (rule-id)
        [SECRET]   Line 12: AWS_ACCESS_KEY - use env vars instead
        |
insertOrCopy(code)
  |-- editor activo: inserta en posicion del cursor
  `-- sin editor:   copia al clipboard + notification
```

---

## Flujo: `arisCode.scanFile`

Palette → "Aris: Scan Current File"

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
  - secrets        --> DiagnosticSeverity.Error
  resultado: squiggles en editor + entradas en panel Problems
        |
showScanSummary(vulns, secrets)
  |-- 0 issues: showInformationMessage
  `-- N issues: showWarningMessage con conteo y severidad
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

## Estructura de Archivos

```
src/
├─ extension.ts                     entry point — activacion, 2 comandos, todas las VSCode API calls
├─ services/
│  ├─ CodeGenerationService.ts      Ollama + OpenAI
│  ├─ SecurityScanningService.ts    Semgrep API → CLI → []
│  └─ SecretDetectionService.ts     truffleHog CLI → regex patterns
├─ types/
│  └─ index.ts                      re-exports Vulnerability, Secret + ScanResult
└─ utils/
   ├─ validation.ts                 validatePrompt() — min 10, max 1000 chars
   └─ logger.ts                     output channel wrapper (disponible para servicios)

tests/
├─ __mocks__/
│  └─ vscode.ts                     mock minimo de VSCode para Jest
└─ unit/
   ├─ validation.test.ts            5 tests
   ├─ SecretDetectionService.test.ts   6 tests
   └─ SecurityScanningService.test.ts  2 tests

Config:
├─ package.json
├─ tsconfig.json
├─ jest.config.js
├─ .eslintrc.json
├─ .prettierrc.json
├─ .env.example
└─ .vscode/
   ├─ launch.json                   F5 → Extension Development Host
   └─ tasks.json                    build task por defecto

Descartado (no necesario para MVP):
  src/webview/                         Output Channel + Diagnostics cubren el caso
  src/commands/                        logica directamente en extension.ts
  src/services/StorageManager.ts       globalState (fase 2)
  src/services/AuditLoggingService.ts  (fase 2)
  src/services/SettingsManager.ts      workspace.getConfiguration directo
  src/services/DependencyAuditService  npm audit (fase 2)
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
  @typescript-eslint/parser: ^6.0.0
  @typescript-eslint/eslint-plugin: ^6.0.0
  prettier: ^3.0.0
  jest: ^29.0.0
  ts-jest: ^29.0.0
  esbuild: ^0.19.0
  @vscode/vsce: ^2.22.0
  rimraf: ^5.0.5

scripts clave:
  dev:          esbuild --sourcemap --watch
  build:        esbuild → dist/extension.js (bundle, sin vscode)
  test:         jest
  test:watch:   jest --watch
  test:coverage jest --coverage
  lint:fix:     eslint src --ext ts --fix
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

## Comandos Registrados

| Command ID | Titulo en palette | Atajo |
|---|---|---|
| `arisCode.generate` | Aris: Generate Secure Code | `Ctrl+Shift+Alt+G` |
| `arisCode.scanFile` | Aris: Scan Current File | — |

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

### Semana 3: Polish & Publish Prep — PROXIMO

**Day 1-2: Assets y documentacion**
```
[ ] assets/icon.png           128x128 PNG, fondo oscuro con icono de candado
[ ] assets/preview.gif        demo animado (opcional pero sube conversiones)
[ ] CHANGELOG.md              entrada para v0.1.0
[ ] README.md para Marketplace descripcion corta (max 250 chars) + screenshots
```

**Day 3: Build y empaquetado**
```bash
npm run build     # verifica que dist/extension.js existe
npm test          # los 13 deben pasar
npm run lint      # cero errores
npm run package   # genera aris-code-0.1.0.vsix
# Instalar localmente: Extensions sidebar > ... > Install from VSIX
```

**Day 4: Verificacion end-to-end en VSCode real**
```
[ ] generate: escribe prompt → Output Channel muestra codigo + scan results
[ ] generate: codigo se inserta en editor activo
[ ] scanFile: abre archivo con password hardcodeado → squiggle roja + Problems panel
[ ] keybinding Ctrl+Shift+Alt+G funciona
[ ] Settings arisCode.* aparecen en VSCode Settings UI
[ ] .gitignore tiene: dist/, node_modules/, *.vsix, .env
[ ] LICENSE file (MIT)
```

**Day 5: Publicacion**
```
[ ] vsce create-publisher alfonsito  (requiere cuenta en marketplace.visualstudio.com)
[ ] Azure DevOps PAT con scope Marketplace (Manage)
[ ] vsce publish
[ ] Extension visible en marketplace.visualstudio.com
[ ] GitHub release con tag v0.1.0 y .vsix adjunto
[ ] Borrador post Product Hunt
[ ] Borrador post r/vscode
```

### Semana 4: Launch

```
vsce publish activo → extension indexada en marketplace
Product Hunt post
Reddit r/vscode + r/programming
Twitter/X + Discord VSCode
GitHub README con badge de marketplace
```

### Quick Start Semana 1 (para retomar contexto rapido)

```bash
# Verificar que todo esta en orden
npm test                    # 13 passing
npm run build               # dist/extension.js generado
code --extensionDevelopmentPath=.   # o F5 desde VSCode
```

Para probar CodeGenerationService directamente:
```bash
# Verificar que Ollama esta corriendo
curl http://localhost:11434/api/generate \
  -d '{"model":"llama2","prompt":"write a hello world function","stream":false}'
```

---

## Fase 2 (post-traction, solo si hay installs)

| Feature | Implementacion |
|---|---|
| npm audit integrado | `DependencyAuditService` + resultado en OutputChannel |
| Historial de generaciones | `context.globalState` + `TreeDataProvider` en sidebar |
| Selector de modelo Ollama | `vscode.window.showQuickPick` con modelos disponibles |
| Webview | Solo si OutputChannel/TreeView no pueden mostrar lo necesario |

---

*Ultima actualizacion: FLUJOEXTENSION completo — esqueleto, dependencias, requisitos, Semana 3 detallada, 13 tests pasando*
