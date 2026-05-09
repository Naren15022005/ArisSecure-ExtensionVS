# Aris Code — VSCode Extension

Extension de VSCode que genera codigo seguro desde el primer momento.
Escribe un prompt, recibe codigo, y antes de que lo uses ya fue escaneado por vulnerabilidades.

---

## Que hace

1. Pides codigo con un prompt en VSCode
2. La extension lo genera via Ollama (local) o OpenAI
3. Lo escanea automaticamente: SAST con Semgrep, secrets con truffleHog
4. Muestra los resultados en el Output Channel con severidad y numero de linea
5. Inserta el codigo en tu editor o lo copia al clipboard

Todo sin salir de VSCode.

---

## Comandos

| Comando | Atajo | Descripcion |
|---|---|---|
| `Aris: Generate Secure Code` | `Ctrl+Shift+Alt+G` | Genera codigo a partir de un prompt y lo escanea |
| `Aris: Scan Current File` | — | Escanea el archivo abierto y marca problemas inline |

---

## Instalacion local (desarrollo)

```bash
git clone https://github.com/Naren15022005/aris-code-extension.git
cd aris-code-extension
npm install
npm run build
```

Abrir VSCode en la carpeta y presionar `F5` para abrir el Extension Development Host.

Para generacion de codigo se necesita Ollama corriendo:

```bash
ollama serve
ollama pull llama2
```

Semgrep y truffleHog son opcionales. Si no estan instalados, la extension sigue funcionando
con deteccion de patrones basica para secrets y sin SAST.

---

## Configuracion

Todas las opciones estan en VSCode Settings bajo `Aris Code`:

| Setting | Default | Descripcion |
|---|---|---|
| `arisCode.llmProvider` | `ollama` | Proveedor: `ollama` o `openai` |
| `arisCode.ollamaHost` | `http://localhost:11434` | URL del servidor Ollama |
| `arisCode.ollamaModel` | `llama2` | Modelo a usar |
| `arisCode.temperature` | `0.7` | Temperatura de generacion (0–2) |
| `arisCode.openaiApiKey` | `""` | API Key de OpenAI (si provider = openai) |
| `arisCode.semgrepApiToken` | `""` | Token de semgrep.dev (opcional) |

---

## Estado del proyecto

### Lo que esta construido

**Servicios core**
- `CodeGenerationService` — genera codigo via Ollama o OpenAI. System prompt orientado a seguridad. Timeout de 60s. Manejo de errores de conexion con mensajes utiles.
- `SecurityScanningService` — SAST con cadena de fallback: Semgrep API → Semgrep CLI → array vacio. Nunca bloquea al usuario.
- `SecretDetectionService` — detecta secrets con truffleHog CLI o regex patterns como fallback. Cubre AWS keys, OpenAI keys, GitHub tokens, passwords, DB URLs, private keys.

**Extension entry point**
- `generateCommand` — flujo completo: input box con validacion, generacion, escaneo paralelo, resultado en Output Channel, insercion en editor o clipboard.
- `scanFileCommand` — escanea el archivo activo, aplica diagnosticos inline (squiggles), muestra resumen en notificacion.

**Configuracion**
- `package.json` con contributes, keybindings, configuration schema
- `tsconfig.json`, `jest.config.js`, `.eslintrc.json`, `.prettierrc.json`
- `.vscode/launch.json` y `tasks.json` para debug con F5

**Tests**
- 13 tests unitarios pasando
- 0 errores de TypeScript
- Coverage >80% en servicios
- Mock de VSCode incluido para correr tests sin VSCode real

### Decisiones tomadas

**Sin Webview.** El MVP usa VSCode APIs nativas (OutputChannel, DiagnosticCollection, showInputBox). Menos codigo, mas rapido al marketplace, mas facil de mantener. El Webview es fase 2 si los usuarios lo piden.

**Fallback chain en todos los scanners.** Si Semgrep no esta instalado, la extension no falla. Si truffleHog no esta instalado, usa regex. El usuario siempre recibe su codigo.

**Servicios sin VSCode.** Los servicios no dependen de la API de VSCode salvo para leer configuracion. Esto los hace testeables con Jest puro sin mocks complejos.

**Escaneos en paralelo.** `Promise.all` para correr Semgrep y truffleHog al mismo tiempo. Reduce el tiempo total a la mitad.

### Que viene

- `assets/icon.png` y `assets/preview.gif` para el marketplace
- `CHANGELOG.md` con entrada v0.1.0
- README para marketplace (descripcion corta + screenshots)
- `npm run package` → `.vsix` → prueba local → `vsce publish`

---

## Estructura del repositorio

```
src/
├─ extension.ts                 entry point
├─ services/
│  ├─ CodeGenerationService.ts
│  ├─ SecurityScanningService.ts
│  └─ SecretDetectionService.ts
├─ types/index.ts
└─ utils/
   ├─ validation.ts
   └─ logger.ts

tests/
├─ __mocks__/vscode.ts
└─ unit/

CLAUDE.md            guia para Claude Code al trabajar en este repo
FLUJOEXTENSION.md    flujo detallado de implementacion y timeline
RECOMENDACIONES.md   decisiones de arquitectura y lecciones aprendidas
```

---

## Comandos de desarrollo

```bash
npm run dev           compila y abre VSCode con la extension cargada
npm run build         bundle de produccion (esbuild → dist/extension.js)
npm test              corre los 13 tests unitarios
npm run test:watch    tests en modo watch
npm run lint:fix      corrige errores de ESLint automaticamente
npm run package       genera el .vsix para distribuir
```

---

## Licencia

MIT
