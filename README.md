# 🛡️ Aris Code — Security & Quality Analysis for VS Code

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Tests](https://img.shields.io/badge/tests-207%2F207%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Open VSX](https://img.shields.io/badge/Open%20VSX-published-purple)

> **Smart security analysis + logic-based remediation.** Detect vulnerabilities, code quality issues, and performance problems — with step-by-step fixes built in. No AI APIs required. Works 100% offline.

---

## 📦 Installation

### Option 1 — Download from Open VSX (Recommended)

**Step 1.** Open the extension page in your browser:

👉 **https://open-vsx.org/extension/alfonsito/aris-code**

**Step 2.** Click the **"Download"** button to get the `.vsix` file.

**Step 3.** Open **VS Code**.

**Step 4.** Press `Ctrl+Shift+P` to open the Command Palette, type:

```
Extensions: Install from VSIX...
```

and press Enter.

**Step 5.** A file picker opens — navigate to your Downloads folder, select the `Naren15022005.aris-code-0.3.0.vsix` file, and click **Install**.

**Step 6.** VS Code will ask you to reload — click **Reload Now**.

Done! The Aris Code shield icon will appear in the Activity Bar on the left.

---

### Option 2 — Install from terminal (one command)

If you have VS Code installed and prefer the terminal:

```bash
code --install-extension "https://github.com/Naren15022005/ArisSecure-ExtensionVS/releases/download/v0.3.0/aris-code-0.3.0.vsix"
```

Or download the file first and then install:

```bash
# 1. Download
curl -L -o aris-code.vsix "https://open-vsx.org/api/Naren15022005/aris-code/0.3.0/file/Naren15022005.aris-code-0.3.0.vsix"

# 2. Install
code --install-extension aris-code.vsix
```

---

### Option 3 — GitHub Releases

Download the `.vsix` directly from:

👉 **https://github.com/Naren15022005/ArisSecure-ExtensionVS/releases/latest**

Then follow Steps 3–6 from Option 1.

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
