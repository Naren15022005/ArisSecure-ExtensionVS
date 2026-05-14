# Aris Code — Guía de Uso

## Qué es

Aris Code es una extensión de VSCode que combina generación de código con IA y análisis de seguridad automático en un único flujo. El usuario describe lo que necesita, la extensión genera el código y lo escanea antes de insertarlo en el editor — todo sin salir de VSCode.

El principio central: el código inseguro no debería llegar al editor en primer lugar. Aris Code aplica ese principio en el momento de generación, no después.

---

## Novedades en v0.2.0

### Sidebar en el Activity Bar
Un nuevo icono **🛡️ Aris Code** aparece en la barra lateral izquierda (junto a Explorer, Extensions, etc.). Al hacer click muestra el panel **Security Issues** con todos los problemas encontrados organizados por severidad.

### Quick Scan Button
Un botón 🛡️ aparece en la barra superior derecha del editor (junto a los botones de split, preview, etc.). Un click escanea el archivo activo y abre automáticamente el sidebar con los resultados.

### Navegación directa al issue
Hacer click en cualquier item del sidebar posiciona el cursor directamente en la línea afectada del código.

---

## Qué hace

### Comando 1: Generar código seguro

El usuario escribe una descripción en lenguaje natural. Aris Code:

1. Envía el prompt a un LLM (Ollama local o OpenAI) con un system prompt que instruye al modelo a evitar las vulnerabilidades del OWASP Top 10.
2. Toma el código generado y lo escanea en paralelo con dos analizadores independientes:
   - **SAST (Semgrep)** — detecta inyección SQL, XSS, inyección de comandos, deserialización insegura y otros patrones del OWASP Top 10.
   - **Detección de secrets (truffleHog / regex)** — detecta credenciales embebidas: AWS keys, OpenAI keys, GitHub tokens, claves privadas, contraseñas en texto plano, URLs de base de datos con credenciales, API keys genéricas.
3. Muestra el código y los resultados en el Output Channel y actualiza el sidebar.
4. Inserta el código en la posición del cursor. Si no hay un editor activo, lo copia al portapapeles.

### Comando 2: Escanear archivo existente

Toma el archivo abierto en el editor y lo pasa por los mismos dos analizadores. Los problemas aparecen en tres lugares simultáneamente:

- **Diagnósticos inline** — subrayados de colores directamente en el código.
- **Panel Problems** — lista completa con descripción y número de línea.
- **Sidebar Security Issues** — lista agrupada por severidad con navegación directa.

### Comando 3: Quick Scan (nuevo en v0.2.0)

Equivale a escanear el archivo activo + abrir automáticamente el sidebar. Diseñado para el flujo más rápido: un click y ves todos los issues sin buscar en los paneles.

---

## Interfaz de usuario

### Activity Bar Sidebar

```
🛡️ Aris Code
└─ Security Issues
   ├─ 🔴 Critical (N)  ← vulnerabilidades críticas y secrets
   │  ├─ [L3]  AWS_ACCESS_KEY — Hardcoded secret — move to env var
   │  └─ [L12] sql-injection  — SQL injection risk
   ├─ 🟠 High (N)
   │  └─ [L7]  xss-reflected — Unsanitized output in HTML context
   ├─ 🟡 Medium (N)
   └─ 🔵 Low (N)
```

- Los grupos se muestran solo si tienen issues.
- Click en un issue → cursor va a esa línea en el editor activo.
- El sidebar se actualiza automáticamente después de cada scan.

### Editor Title Bar

El botón 🛡️ aparece en la barra superior derecha del editor cuando hay un archivo activo. Click → Quick Scan.

---

## Alcance

### Lo que Aris Code cubre

| Categoría | Qué detecta |
|---|---|
| Inyección SQL | Consultas construidas con concatenación de strings |
| XSS | Salida sin sanitizar en contextos HTML |
| Inyección de comandos | `exec`, `system`, `eval` con input no validado |
| Deserialización insegura | Uso de `pickle`, `eval(JSON)`, etc. |
| Secrets embebidos | AWS, OpenAI, GitHub, claves privadas, contraseñas, DB URLs |
| API keys genéricas | Patrones `secret=`, `token=`, `api_key=` con valores literales |

### Lo que Aris Code no cubre (aún)

- Auditoría de dependencias (`npm audit`, `pip audit`) — planificado para v0.3.0
- Análisis de configuración de infraestructura (Dockerfile, Terraform)
- Vulnerabilidades en tiempo de ejecución (DAST)
- Re-escaneo automático al guardar el archivo

### Idiomas y frameworks soportados

Aris Code no está limitado a un lenguaje. Semgrep soporta Python, JavaScript, TypeScript, Go, Java, Ruby, PHP, C/C++, entre otros. Los patrones regex de secrets funcionan en cualquier archivo de texto.

---

## Logros por versión

### v0.2.0

| Métrica | Valor |
|---|---|
| Tests unitarios | 24 pasando, 0 errores |
| Archivos nuevos | `src/views/IssueTreeProvider.ts` |
| Comandos nuevos | `arisCode.quickScan`, `arisCode.goToIssue` |
| UI nueva | Activity Bar sidebar + editor title button |
| Tamaño del bundle | 485 KB |

### v0.1.0

| Métrica | Valor |
|---|---|
| Tests unitarios | 13 pasando, 0 errores TypeScript |
| Cobertura en servicios | >80% |
| Líneas de código (sin contar config) | ~500 |
| Dependencias de producción | 1 (axios) |
| Dependencias externas obligatorias | 0 (todo degrada gracefully) |

La extensión funciona sin Semgrep, sin truffleHog y sin Ollama instalados. En el peor caso (sin ninguna herramienta externa) sigue detectando secrets via regex y genera código si hay una API Key de OpenAI configurada.

---

## Instalación

### Requisitos mínimos

| Herramienta | Versión mínima | Verificar |
|---|---|---|
| Node.js | 18.0.0 | `node --version` |
| npm | 9.0.0 | `npm --version` |
| VSCode | 1.60.0 | Help → About |

### Herramientas opcionales (recomendadas)

| Herramienta | Para qué | Cómo instalar |
|---|---|---|
| Ollama | Generación de código local (sin API key) | [ollama.ai](https://ollama.ai) |
| Semgrep | SAST completo | `pip install semgrep` |
| truffleHog | Detección de secrets más precisa | `pip install truffleHog` |

### Instalar desde .vsix

```
Ctrl+Shift+X → botón ··· (más acciones) → Install from VSIX
Seleccionar: aris-code-0.2.0.vsix
Recargar VSCode
```

### Instalar desde el repositorio (modo desarrollo)

```bash
git clone https://github.com/Naren15022005/aris-code-extension.git
cd aris-code-extension
npm install
npm run build
```

Abrir la carpeta en VSCode y presionar **F5** para abrir el Extension Development Host con la extensión cargada.

### Verificar que todo funciona

```bash
npm test         # deben pasar los 24 tests
npm run build    # debe generar dist/extension.js
```

---

## Configuración

Todas las opciones están en VSCode Settings (`Ctrl+,`) bajo la sección **Aris Code**. No se necesita editar archivos de configuración manualmente.

| Setting | Default | Cuándo cambiarlo |
|---|---|---|
| `arisCode.llmProvider` | `ollama` | Cambiar a `openai` si no se tiene Ollama instalado |
| `arisCode.ollamaHost` | `http://localhost:11434` | Si Ollama corre en otro puerto o máquina |
| `arisCode.ollamaModel` | `llama2` | Cambiar al modelo descargado (ej. `mistral`, `codellama`) |
| `arisCode.temperature` | `0.7` | Bajar para código más determinístico, subir para más variedad |
| `arisCode.openaiApiKey` | `""` | Requerido si `llmProvider` = `openai` |
| `arisCode.semgrepApiToken` | `""` | Para usar la API de semgrep.dev en lugar del CLI local |

### Configurar Ollama (opción local, sin costo)

```bash
# Instalar Ollama desde https://ollama.ai
ollama serve                # iniciar el servidor
ollama pull llama2          # descargar el modelo base
# o usar un modelo orientado a código:
ollama pull codellama
```

En VSCode Settings: `arisCode.ollamaModel` → `codellama`

### Configurar OpenAI (opción en la nube)

1. Obtener una API Key en platform.openai.com
2. En VSCode Settings: `arisCode.llmProvider` → `openai`
3. En VSCode Settings: `arisCode.openaiApiKey` → pegar la key

La extensión usa `gpt-4o-mini` por defecto (económico y rápido).

---

## Uso paso a paso

### Escaneo rápido (recomendado en v0.2.0)

**Click:** botón 🛡️ en la barra superior derecha del editor  
**Atajo:** `Ctrl+Shift+Alt+Q`

1. Abrir el archivo a analizar.
2. Click en el botón 🛡️ (o usar el atajo).
3. El spinner aparece brevemente.
4. El sidebar **Security Issues** se abre automáticamente con los resultados agrupados por severidad.
5. Click en cualquier issue → el cursor va a esa línea.

### Escanear un archivo existente (scan completo)

**Atajo:** `Ctrl+Shift+Alt+S`  
**Palette:** `Ctrl+Shift+P` → "Aris: Scan Current File"

1. Tener un archivo abierto en el editor (cualquier lenguaje).
2. Ejecutar el comando. Aparece una notificación con spinner.
3. Al terminar:
   - Si no hay problemas: notificación verde "No issues detected."
   - Si hay problemas: notificación amarilla con el conteo.
4. Los resultados aparecen en tres lugares:
   - **Squiggles inline** — rojo (critical/high/secrets), amarillo (medium/low).
   - **Panel Problems** (`Ctrl+Shift+M`) — lista con descripción y número de línea.
   - **Sidebar** — lista agrupada por severidad con click para navegar.

### Generar código seguro desde un prompt

**Atajo:** `Ctrl+Shift+Alt+G`  
**Palette:** `Ctrl+Shift+P` → "Aris: Generate Secure Code"

1. Se abre un input box. Escribir la descripción del código que se necesita.
   - Mínimo 10 caracteres, máximo 1000.
   - Ejemplos válidos:
     - `Python function that validates and sanitizes email input`
     - `JavaScript fetch wrapper with error handling and timeout`
     - `SQL query to get users by role with parameterized inputs`
2. Presionar Enter. Aparece una notificación con spinner ("Generating code...").
3. Cuando termina la generación, el spinner cambia a "Scanning for vulnerabilities...".
4. El Output Channel "Aris Code" se abre automáticamente con código y resultados del escaneo.
5. El sidebar se actualiza con los issues encontrados.
6. El código se inserta en la posición del cursor del editor activo. Si no hay editor abierto, se copia al portapapeles.

---

## Interpretar los resultados

### Sidebar (v0.2.0)

| Grupo | Significado |
|---|---|
| 🔴 Critical | Secrets embebidos y vulnerabilidades explotables de inmediato |
| 🟠 High | Vulnerabilidades serias (XSS, inyección de comandos) |
| 🟡 Medium | Vulnerabilidades con contexto limitado |
| 🔵 Low | Prácticas subóptimas de seguridad |

### Output Channel (comando generate)

| Prefijo | Significado | Acción recomendada |
|---|---|---|
| `[CRITICAL]` | Vulnerabilidad explotable de inmediato (ej. SQL injection) | Reescribir la lógica afectada |
| `[HIGH]` | Vulnerabilidad seria (ej. XSS sin sanitizar) | Revisar y corregir antes de usar |
| `[MEDIUM]` | Vulnerabilidad presente pero con contexto limitado | Evaluar si aplica al caso de uso |
| `[LOW]` | Práctica subóptima de seguridad | Corregir si el tiempo lo permite |
| `[SECRET]` | Credencial embebida en el código | Mover a variable de entorno inmediatamente |

### Diagnósticos inline

Pasar el cursor sobre el subrayado muestra el mensaje completo con la regla que lo detectó. Hacer clic en el issue en el panel Problems lleva directamente a la línea afectada.

---

## Cadena de fallback

La extensión nunca bloquea al usuario. Si una herramienta no está disponible, pasa a la siguiente:

```
SAST:
  1. Semgrep API     (si arisCode.semgrepApiToken está configurado)
  2. Semgrep CLI     (si está instalado en PATH)
  3. Sin escaneo     (retorna [] sin error)

Secrets:
  1. truffleHog CLI  (si está instalado en PATH)
  2. Regex patterns  (siempre disponible — 7 patrones cubriendo los tipos más comunes)
```

En la práctica: instalar Semgrep y truffleHog mejora la cobertura, pero la extensión es útil desde el primer momento sin ellos.

---

## Desarrollo y extensión

### Correr en modo desarrollo

```bash
npm run dev     # compila con sourcemaps y watch automático
# En VSCode: F5 → abre Extension Development Host
# Cambiar código → los cambios se recompilan → Ctrl+R en el Dev Host para recargar
```

### Comandos útiles

```bash
npm test                  # 24 tests unitarios
npm run test:coverage     # reporte de cobertura
npm run test:watch        # tests en modo watch durante desarrollo
npm run lint:fix          # corrige errores de ESLint automáticamente
npm run format            # formatea con Prettier
npm run package           # genera aris-code-0.2.0.vsix
```

### Agregar un nuevo scanner

1. Crear `src/services/MiScanner.ts` con el patrón fallback chain (try/catch anidado, retorna `[]` en el catch final).
2. Instanciar en `src/extension.ts` y llamar desde `generateCommand` y `scanFileCommand` dentro del `Promise.all`.
3. Mapear el resultado a `IssueData[]` en la función `buildIssueData` para que aparezca en el sidebar.
4. Agregar los tipos necesarios en `src/types/index.ts`.
5. Escribir tests en `tests/unit/MiScanner.test.ts` mockeando solo las dependencias externas.

### Agregar un nuevo comando

1. Agregar `registerCommand('arisCode.miComando', miFuncion)` en `activate()` dentro de `src/extension.ts`.
2. Declarar el comando en `package.json` bajo `contributes.commands`.
3. Toda la lógica de VSCode API (showInputBox, OutputChannel, etc.) debe vivir en `extension.ts`, no en los servicios.

---

## Preguntas frecuentes

**¿Funciona sin conexión a internet?**  
Sí, con Ollama corriendo localmente. La detección de secrets por regex también funciona sin conexión. Solo Semgrep API y OpenAI requieren internet.

**¿El código generado es enviado a algún servidor externo?**  
Depende de la configuración. Con Ollama (por defecto), el código nunca sale de la máquina local. Con OpenAI o Semgrep API, el código se envía a esos servicios. Revisar sus políticas de privacidad respectivas.

**¿Por qué el sidebar está vacío?**  
El sidebar solo muestra issues después de ejecutar un scan. Usar el botón 🛡️ o `Ctrl+Shift+Alt+Q` para escanear el archivo actual.

**¿El sidebar se actualiza solo al editar?**  
No. El re-escaneo es manual en v0.2.0. Hay que ejecutar Quick Scan o Scan File después de cada modificación relevante.

**¿Puedo usar un modelo diferente a llama2?**  
Sí. Descargar el modelo con `ollama pull <modelo>` y cambiar `arisCode.ollamaModel` en Settings. Modelos recomendados para código: `codellama`, `deepseek-coder`, `mistral`.

**¿Los squiggles desaparecen al editar el archivo?**  
Los diagnósticos permanecen hasta la próxima vez que se ejecute el comando o se cierre el archivo. Editar el archivo no dispara un re-escaneo automático (esto es intencional en v0.2.0).

---

## Roadmap

| Feature | Estado | Versión estimada |
|---|---|---|
| Generación + escaneo SAST + secrets | Completo | v0.1.0 |
| Escaneo de archivo existente | Completo | v0.1.0 |
| Sidebar Activity Bar con lista de issues | Completo | v0.2.0 |
| Quick Scan button en editor title | Completo | v0.2.0 |
| Navegación click → línea del issue | Completo | v0.2.0 |
| Re-escaneo automático al guardar | Planificado | v0.3.0 |
| Auditoría de dependencias (`npm audit`) | Planificado | v0.3.0 |
| Apply Fix desde el sidebar | Planificado | v0.3.0 |
| Selector de modelo Ollama (QuickPick) | Planificado | v0.3.0 |
| Soporte para más providers (Anthropic, Groq) | Sin fecha | v0.4.0+ |
| Análisis de Dockerfile / Terraform | Sin fecha | v0.4.0+ |

---

## Limitaciones conocidas en v0.2.0

- El re-escaneo no es automático al editar un archivo; hay que ejecutar el comando manualmente.
- El sidebar solo muestra issues del último scan; no hay historial entre sesiones.
- Semgrep CLI puede tardar 10-30 segundos en archivos grandes con `--config auto`.
- Los patrones regex de secrets pueden producir falsos positivos en comentarios o código de ejemplo. truffleHog es más preciso.
- El timeout de generación es de 60 segundos. Modelos grandes en hardware lento pueden excederlo.
- No hay soporte para streaming de la respuesta del LLM; el código aparece completo o no aparece.

---

*Aris Code v0.2.0 — MIT License*
