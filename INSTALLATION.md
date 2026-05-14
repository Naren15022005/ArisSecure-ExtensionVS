# Installation Guide

## Requirements

| Tool | Minimum | Check |
|------|---------|-------|
| Node.js | 18.0.0 | `node --version` |
| npm | 9.0.0 | `npm --version` |
| VSCode | 1.60.0 | Help → About |

## Setup (5 minutes)

### 1. Clone Repository
```bash
git clone https://github.com/Naren15022005/ArisSecure-ExtensionVS.git
cd ArisSecure-ExtensionVS
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build
```bash
npm run build
```

Verify: Check `dist/extension.js` exists (~612kb)

### 4. Load in VSCode

**Option A: Development Mode**
```bash
npm run dev
# Then in VSCode: Press F5
```

**Option B: Package & Install**
```bash
npm run package
# Creates arisecure-0.3.0.vsix
# Ctrl+Shift+X → ... → Install from VSIX
```

## Verification

```bash
# Run tests
npm test
# Should show: 205 passing ✅

# Check build
ls -lh dist/extension.js
# Should be ~612kb
```

## Troubleshooting

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install --force
```

### "TypeScript errors"
```bash
npx tsc --noEmit
# Fix any errors shown
```

### "Tests failing"
```bash
npm test -- --verbose
# Shows which tests failed
```

### "Extension won't load"
- Check VSCode version (must be 1.60+)
- Check Node version (must be 18+)
- Check `dist/extension.js` exists
- Try restarting VSCode

## Next Steps

1. Open a `.js` or `.ts` file
2. Press `Ctrl+Shift+Alt+S` to scan
3. See issues in sidebar
4. Click an issue to view remediation
