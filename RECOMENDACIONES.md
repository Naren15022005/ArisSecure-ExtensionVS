# RECOMENDACIONES.md

Lecciones aprendidas y decisiones de arquitectura tomadas durante el desarrollo de Aris Code.
Sirve como guia para no repetir errores y mantener criterio consistente al iterar.

---

## Arquitectura

### Sin Webview en el MVP

La primera version construia un Webview completo con HTML/CSS/JS. Era ~800 lineas de codigo
para hacer lo que las VSCode APIs nativas hacen en ~200.

Regla que se aplica en este proyecto:

> Usa VSCode APIs nativas primero. Solo usa Webview si las APIs nativas genuinamente no pueden hacerlo.

Para este MVP, todo lo necesario esta cubierto nativamente:

| Necesidad | API nativa | Webview necesario |
|---|---|---|
| Input del usuario | `showInputBox` | No |
| Mostrar resultados | `OutputChannel` | No |
| Vulnerabilidades inline | `DiagnosticCollection` | No |
| Configuracion | `workspace.getConfiguration` | No |
| Historial (fase 2) | `TreeDataProvider` | No |

### Toda la logica VSCode en extension.ts

Los servicios (`CodeGenerationService`, `SecurityScanningService`, `SecretDetectionService`)
no importan `vscode` salvo para leer configuracion. Toda llamada a VSCode API
(`showInputBox`, `OutputChannel`, `DiagnosticCollection`, etc.) vive en `extension.ts`.

Esto hace que los servicios sean testeables sin mocks complejos.

### Los servicios nunca bloquean al usuario

Todos los scanners retornan `[]` en caso de error. Si Semgrep no esta instalado,
si el token es invalido, si truffleHog falla — el usuario igual recibe su codigo generado.

```typescript
// patron que siguen todos los scanners
async scan(code: string): Promise<Vulnerability[]> {
  try {
    return await this.scanApi(code);
  } catch {
    try {
      return await this.scanCli(code);
    } catch {
      return [];   // nunca lanza, nunca bloquea
    }
  }
}
```

### Los escaneos corren en paralelo

```typescript
const [vulns, detectedSecrets] = await Promise.all([
  security.scan(code),
  secrets.detect(code),
]);
```

No se espera a que uno termine para iniciar el otro. En la practica reduce el tiempo
percibido a la mitad cuando ambos tardan similar.

---

## Codigo

### Sin emojis en el codigo fuente

Los emojis en strings de UI dentro del codigo TypeScript:
- Rompen en terminales que no los soportan
- Son dificiles de grep/buscar
- Mezclan presentacion con logica

El OutputChannel usa texto plano con prefijos en mayuscula:

```typescript
// mal
outputChannel.appendLine('🔴 Vulnerabilidad critica detectada');

// bien
outputChannel.appendLine('[CRITICAL] SQL injection detected (rule-id)');
```

Si se quieren iconos en el futuro, se agregan en la capa de presentacion (Webview o TreeItem).

### Funciones pequenas con una responsabilidad

`extension.ts` tiene funciones separadas para cada paso del flujo:

```
generateCommand()        orquesta el flujo completo
writeResultsToOutput()   solo escribe al OutputChannel
insertOrCopy()           solo inserta o copia el codigo
applyDiagnostics()       solo construye y aplica diagnosticos
showScanSummary()        solo muestra la notificacion final
```

Cada funcion hace una cosa. Si crece mas de ~25 lineas, es candidata a dividirse.

### Sin servicios innecesarios en el MVP

Se descartaron estos servicios que estaban en la primera version:

- `StorageManager` — globalState para historial. No hace falta hasta tener usuarios que lo pidan.
- `AuditLoggingService` — log de cada generacion. Overhead sin beneficio en MVP.
- `SettingsManager` — wrapper de `workspace.getConfiguration`. Innecesario cuando la configuracion es simple.
- `DependencyAuditService` — npm audit. Util pero no core para el MVP.

Regla: no construir servicios para necesidades hipoteticas. Si un usuario lo pide, se agrega.

---

## Testing

### Mockear solo lo externo, no la logica

Los tests unitarios mockean:
- `vscode` — porque no existe en Node puro
- `child_process` — para controlar si CLI esta disponible o no
- `axios` — para controlar respuestas de API

No se mockea logica propia. Si un test requiere mockear codigo propio, es senal
de que hay un problema de acoplamiento en el diseno.

### El fallback es lo que se testea

El caso critico no es "funciona con Semgrep instalado" sino "funciona sin Semgrep instalado".
Los tests fuerzan el fallo del CLI para verificar que el fallback funciona correctamente.

```typescript
jest.mock('child_process', () => ({
  exec: jest.fn((_cmd, _opts, cb) => cb(new Error('not installed'))),
}));

it('returns empty array when semgrep not available', async () => {
  const result = await svc.scan('any code');
  expect(result).toHaveLength(0);   // no lanza, retorna []
});
```

### extension.ts excluido del coverage

`extension.ts` registra comandos VSCode y no tiene logica de negocio testeble con Jest.
Se excluye de coverage en `jest.config.js` y se verifica manualmente con F5.

---

## Configuracion

### jest.config.js separado de package.json

Tener la configuracion de Jest dentro de `package.json` bajo la key `jest` funciona,
pero mezcla responsabilidades. El archivo separado `jest.config.js` es mas legible
y permite agregar opciones avanzadas sin ensuciar el manifesto de la extension.

### esbuild en lugar de tsc para produccion

`tsc` compila pero no bundlea. Para distribuir la extension, se necesita un solo archivo
`dist/extension.js` que incluya todas las dependencias (excepto `vscode`, que es externa).

```bash
esbuild ./src/extension.ts \
  --bundle \
  --outfile=dist/extension.js \
  --external:vscode \
  --platform=node
```

Para desarrollo se agrega `--sourcemap --watch`.

### activationEvents vacio

VSCode 1.74+ genera los `activationEvents` automaticamente desde `contributes.commands`.
Dejarlos vacios evita el warning y elimina duplicacion.

---

## Flujo de Publicacion

### Personal Access Token de Azure DevOps

`vsce publish` requiere un PAT de Azure DevOps con scope `Marketplace (Manage)`.
No es el mismo token que GitHub. Pasos:

1. Ir a `dev.azure.com` → User Settings → Personal Access Tokens
2. Crear token con Organization: All accessible organizations
3. Scope: Marketplace → Manage
4. Guardar el token (se muestra una sola vez)
5. `vsce create-publisher <nombre>` (primera vez)
6. `vsce publish` — pide el PAT

### Verificar .vsix antes de publicar

```bash
npm run package              # genera .vsix
# En VSCode: Extensions > ... > Install from VSIX
# Probar ambos comandos en una ventana limpia (sin dev host)
# Si funciona, entonces: vsce publish
```

Publicar directamente sin probar el .vsix localmente es el error mas comun.

---

## Lo que NO hacer

- No agregar Webview antes de tener usuarios que lo pidan.
- No crear servicios de abstraccion antes de tener la necesidad concreta.
- No usar emojis en strings dentro del codigo TypeScript.
- No escribir comentarios que explican el que (el codigo ya lo dice), solo el por que.
- No poner logica de negocio en `extension.ts` — ese archivo solo orquesta.
- No mockear logica propia en tests — si hay que hacerlo, el diseno tiene un problema.
- No publicar sin instalar y probar el .vsix localmente primero.
- No agregar `activationEvents` manualmente en VSCode 1.74+.

---

## Checklist antes de `vsce publish`

```
[ ] npm test          todos los tests pasan
[ ] npm run lint      cero errores de ESLint
[ ] npm run build     dist/extension.js existe y tiene contenido
[ ] npm run package   .vsix generado sin errores
[ ] .vsix instalado localmente y ambos comandos funcionan
[ ] assets/icon.png   existe (128x128 PNG), vsce falla sin el si esta declarado
[ ] README.md         tiene descripcion, screenshot o gif, instrucciones de uso
[ ] CHANGELOG.md      tiene entrada para la version que se va a publicar
[ ] .gitignore        incluye dist/, *.vsix, .env
[ ] LICENSE           existe (MIT recomendado para OSS)
[ ] package.json      version, publisher, description, repository correctos
```

---

*Documento generado tras el desarrollo del MVP de Aris Code — v0.1.0*
