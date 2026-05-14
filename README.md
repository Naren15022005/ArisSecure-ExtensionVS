# 🛡️ ArisSecure — Code Security & Quality Analysis

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Tests](https://img.shields.io/badge/tests-205%2F205%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Build](https://img.shields.io/badge/build-clean%20612kb-success)

> **Smart security analysis + logic-based remediation.** Detect vulnerabilities, code quality issues, and performance problems—with step-by-step fixes. No AI APIs required. Works offline. 100% deterministic.

## 📸 What It Does

### Scan Files for Issues
Ctrl+Shift+Alt+S → Scans for 100+ patterns → Shows in sidebar + inline squiggles → Click issue → detailed remediation

### 4 Domains of Analysis

| Domain | Issues | Examples |
|--------|--------|----------|
| 🔴 **Security** | 30+ | SQL Injection, XSS, Hardcoded secrets |
| 🟠 **Quality** | 8+ | Empty catch, console.log, Magic numbers |
| 🔵 **DevOps** | 6+ | Unhandled promises, Missing timeouts |
| 🟣 **Scalability** | 6+ | N+1 queries, Sequential awaits |

### Logic-Based Remediation (No AI APIs)

Every issue includes:
- ✅ **Problem** — What's wrong
- ✅ **Explanation** — Why it matters
- ✅ **Code Examples** — Bad vs. Good
- ✅ **Step-by-step Guidance** — How to fix
- ✅ **Estimated Time** — Minutes to fix
- ✅ **Performance Gains** — Quantified impact

## 🚀 Quick Start

```bash
git clone https://github.com/Naren15022005/ArisSecure-ExtensionVS.git
cd ArisSecure-ExtensionVS
npm install
npm run build
npm run dev
# Press F5 in VSCode
```

## 📋 Commands

| Command | Shortcut |
|---------|----------|
| **Scan File** | `Ctrl+Shift+Alt+S` |
| **Quick Scan** | `Ctrl+Shift+Alt+Q` |
| **Apply Fix** | Click issue → "Apply" |
| **Suggest Fix** | Click issue → see guide |

## 📚 Documentation

- **[INSTALLATION.md](./INSTALLATION.md)** — Setup guide
- **[USAGE.md](./USAGE.md)** — Features & workflows
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — For contributors
- **[CHANGELOG.md](./CHANGELOG.md)** — Version history
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — How to contribute

## ✅ What's Included

- **50+ Built-in Rules** across 4 domains
- **Smart Severity** — Context-aware analysis
- **Issue Relationships** — Optimal fix ordering
- **Auto-Fix** — Automatic fixes for 10+ patterns
- **Logic-Based Remediation** — 18 detailed guides
- **Zero Dependencies** — Works completely offline
- **205 Tests** — Production-ready code

## 🔒 Security & Privacy

- ✅ No external APIs
- ✅ No telemetry
- ✅ No data collection
- ✅ 100% offline
- ✅ MIT licensed

## 📊 Stats

| Metric | Value |
|--------|-------|
| Tests | 205/205 ✅ |
| Build | 612.7kb |
| Coverage | >85% |
| Version | 0.3.0 |

---

**Built with ❤️** | [Report Issue](https://github.com/Naren15022005/ArisSecure-ExtensionVS/issues) | [Discussions](https://github.com/Naren15022005/ArisSecure-ExtensionVS/discussions)
