# 🛡️ Aris Code — Security & Quality Analysis for VS Code

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Tests](https://img.shields.io/badge/tests-207%2F207%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Open VSX](https://img.shields.io/badge/Open%20VSX-published-purple)

> **Smart security analysis + logic-based remediation.** Detect vulnerabilities, code quality issues, and performance problems — with step-by-step fixes built in. No AI APIs required. Works 100% offline.

---

## 📦 Installation

### Option 1 — Download from Open VSX + install via terminal (Recommended)

**Step 1.** Open the extension page and download the file:

👉 **https://open-vsx.org/extension/alfonsito/aris-code**

Click the **"Download"** button. The file `Naren15022005.aris-code-0.3.0.vsix` will save to your Downloads folder.

---

**Step 2.** Open a terminal and navigate to where the file was downloaded:

```bash
# On Linux / macOS
cd ~/Downloads

# On Windows (PowerShell)
cd $HOME\Downloads
```

---

**Step 3.** Install the extension with this exact command:

```bash
code --install-extension Naren15022005.aris-code-0.3.0.vsix
```

You should see:

```
Installing extensions...
Extension 'Naren15022005.aris-code-0.3.0.vsix' was successfully installed.
```

---

**Step 4.** Restart VS Code and look for the 🛡️ shield icon in the Activity Bar on the left.

That's it — you're ready to scan.

---

### Option 2 — Install from VS Code UI (no terminal needed)

**Step 1.** Download the file from:

👉 **https://open-vsx.org/extension/Naren15022005/aris-code**

Click **"Download"** → the `.vsix` file saves to your Downloads folder.

**Step 2.** Open VS Code → press `Ctrl+Shift+P` → type:

```
Extensions: Install from VSIX...
```

**Step 3.** In the file picker, navigate to Downloads, select `Naren15022005.aris-code-0.3.0.vsix` → click **Install**.

**Step 4.** Click **Reload Now** when prompted.

---

### Option 3 — One command (Linux / macOS)

If you prefer a single command that downloads and installs in one step:

```bash
# Download
curl -L -o Naren15022005.aris-code-0.3.0.vsix \
  "https://open-vsx.org/api/Naren15022005/aris-code/0.3.0/file/Naren15022005.aris-code-0.3.0.vsix"

# Install
code --install-extension Naren15022005.aris-code-0.3.0.vsix
```

---

### Option 4 — GitHub Releases

Download the `.vsix` directly from:

👉 **https://github.com/Naren15022005/ArisSecure-ExtensionVS/releases/latest**

Then open a terminal, navigate to your Downloads folder, and run:

```bash
cd ~/Downloads
code --install-extension aris-code-0.3.0.vsix
```

---

## 🚀 First Use

After installing, open any code file and:

| Action | How |
|--------|-----|
| **Quick Scan** | `Ctrl+Shift+Alt+Q` |
| **Full Scan** | `Ctrl+Shift+Alt+S` |
| **View issues** | Click the 🛡️ shield icon in the Activity Bar |
| **See fix guide** | Click any issue in the sidebar |
| **Apply auto-fix** | Click the 🔧 wrench button on the issue |

---

## 🔍 What It Detects

### 4 Domains of Analysis

| Domain | Issues | Examples |
|--------|--------|----------|
| 🔴 **Security** | 30+ | SQL Injection, XSS, Hardcoded secrets, NoSQL Injection |
| 🟠 **Quality** | 8+ | Empty catch, console.log, Magic numbers, Long functions |
| 🔵 **DevOps** | 6+ | Unhandled promises, Missing timeouts, Hardcoded IPs |
| 🟣 **Scalability** | 6+ | N+1 queries, Sequential awaits, Missing indexes |

### What You Get for Every Issue

- ✅ **Problem** — What's wrong and why
- ✅ **Code Example** — Vulnerable vs. Secure side by side
- ✅ **Step-by-step Fix** — Numbered instructions
- ✅ **Standard** — OWASP / CWE reference with link
- ✅ **Estimated Time** — Minutes needed to fix
- ✅ **Related Issues** — What else to check

---

## 🖥️ Sidebar — Issues & Fixes

Issues are grouped by severity so you know what to fix first:

```
🛡️ ARIS CODE — ISSUES & FIXES

  Critical (2)
  ├─ [L8]  SQL_INJECTION        [SEC]  SQL query built with concatenation…
  └─ [L3]  HARDCODED_PASSWORD   [SEC]  Hardcoded secret in source code…

  High (3)
  ├─ [L12] EMPTY_CATCH          [QUA]  Error silently ignored…
  └─ [L15] UNHANDLED_PROMISE    [DEV]  Promise without .catch()…

  Medium (1)
  └─ [L30] MAGIC_NUMBER         [QUA]  Magic number — extract to constant…
```

Click any issue → jumps to the line in your editor + shows full remediation guide in the Output panel.

---

## ✅ Features

- **100+ detection patterns** across Security, Quality, DevOps, Scalability
- **Smart severity** — context-aware, adjusts based on surrounding code
- **Auto-fix** — one-click fixes for 10+ common patterns
- **Logic-based remediation** — 18 detailed fix guides, no AI needed
- **Issue relationships** — shows which issues to fix first
- **Inline diagnostics** — squiggly lines in the editor
- **Zero external dependencies** — works completely offline
- **207 tests** — production-ready

---

## 🔒 Privacy

- ✅ No internet connection required
- ✅ No telemetry or usage tracking
- ✅ No data sent anywhere
- ✅ MIT licensed — free forever

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Tests | 207/207 ✅ |
| Bundle | 143 KB |
| Version | 0.3.0 |
| License | MIT |

---

**[Report a bug](https://github.com/Naren15022005/ArisSecure-ExtensionVS/issues)** · **[Open VSX page](https://open-vsx.org/extension/Naren15022005/aris-code)** · **[Releases](https://github.com/Naren15022005/ArisSecure-ExtensionVS/releases)**
