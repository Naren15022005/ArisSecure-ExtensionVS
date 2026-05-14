# Usage Guide

## Quick Start

### Scan Current File
**Shortcut:** `Ctrl+Shift+Alt+S`

Scans the active file for issues.

**Flow:**
1. Open any JavaScript/TypeScript file
2. Press `Ctrl+Shift+Alt+S`
3. Issues appear in:
   - Sidebar (grouped by domain)
   - Inline squiggles (red/yellow underlines)
   - Output panel (detailed list)

### Quick Scan
**Shortcut:** `Ctrl+Shift+Alt+Q`

Scan + automatically focus sidebar.

### Apply Fix
**Action:** Click issue in sidebar, then "Apply Fix" button

Shows:
- Auto-fix preview (for secrets, console.log, etc.)
- Confirmation dialog
- Or manual remediation guide

### Suggest Fix
**Action:** Click issue → view remediation guide

Shows:
- Problem explanation
- Current code (bad)
- Suggested code (good)
- Step-by-step guidance
- Estimated fix time
- Performance gains (if applicable)

## Understanding Results

### Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🔴 Critical | Exploitable NOW | Fix immediately |
| 🟠 High | Serious issue | Fix before merge |
| 🟡 Medium | Worth fixing | Fix when time allows |
| 🔵 Low | Best practice | Fix eventually |

### Example: SQL Injection

**Problem:**  
SQL query built with string concatenation

**Current Code (Bad):**
```javascript
const query = "SELECT * FROM users WHERE id = " + userId
db.query(query)
```

**Suggested Code (Good):**
```javascript
const query = "SELECT * FROM users WHERE id = ?"
db.query(query, [userId])
```

**Steps:**
1. Replace concatenation with `?` placeholders
2. Pass parameters as a separate array
3. Test with various inputs (quotes, semicolons, etc.)

**Why:**
Parameterized queries prevent SQL injection attacks

## Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+Alt+S` | Scan file |
| `Ctrl+Shift+Alt+Q` | Quick scan |

## Configuration

### Custom Rules

Create `arisecure.config.json` in project root:

```json
{
  "version": 1,
  "rules": {
    "MY_RULE": {
      "name": "My Custom Rule",
      "pattern": "regex_pattern",
      "severity": "High",
      "message": "What this detects",
      "fix": "How to fix it",
      "excludeFiles": ["test", "spec"]
    }
  },
  "thresholds": {
    "maxCritical": 0,
    "maxHigh": 5
  }
}
```

Rules are loaded automatically on every scan.

## Tips & Tricks

### 1. Focus on Critical Issues First
Scan → Look for 🔴 Critical → Fix in order

### 2. Use Auto-Fix for Quick Wins
Secrets, console.log, TODOs → can auto-fix  
Others → requires manual implementation

### 3. Create Team Custom Rules
`arisecure.config.json` → commit to repo  
→ Everyone gets same rules

### 4. Monitor Issue Relationships
Show Relationships → Understand dependencies  
→ Fix in optimal order

## Workflow Examples

### Example 1: Quick Security Audit

```
Ctrl+Shift+Alt+S (scan file)
Look for 🔴 Critical
Click each issue
Review suggested fix
Apply fix or note for manual review
```

### Example 2: Code Review Before Merge

```
Run scan on changed files
Check for Critical + High
Fix or create tech debt issues
Record feedback
```

## FAQs

**Q: Does it send code to external servers?**  
A: No. Everything runs locally. Zero external calls.

**Q: Can I run it from command line?**  
A: Standalone CLI available: `node dist/cli.js --path ./src`

**Q: Does it work offline?**  
A: Yes. No internet required.

**Q: How often should I scan?**  
A: After significant changes. Or before every commit.

**Q: Can I auto-fix all issues?**  
A: Only ~15 types can auto-fix. Others need manual review.

**Q: How do I report a false positive?**  
A: GitHub Issues. Include code + expected behavior.
