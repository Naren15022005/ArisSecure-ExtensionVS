# Development Guide

## Setup

```bash
git clone https://github.com/Naren15022005/ArisSecure-ExtensionVS.git
cd ArisSecure-ExtensionVS
npm install
npm run dev  # Watch mode
```

## Running

### Development Mode
```bash
npm run dev    # Watch + sourcemap
# Then F5 in VSCode
```

### Testing
```bash
npm test           # All tests
npm test:watch     # Watch mode
npm run coverage   # Coverage report
```

### Building
```bash
npm run build   # Production build
npm run package # Create .vsix
```

## Code Style

- **Language:** TypeScript
- **Linter:** ESLint
- **Formatter:** Prettier
- **Tests:** Jest

Auto-fix:
```bash
npm run lint:fix
npm run format
```

## Architecture

```
src/
├─ extension.ts                    Entry point
├─ services/
│  ├─ SecurityScanningService.ts   30+ patterns
│  ├─ CodeQualityExpertService.ts  8 patterns
│  ├─ DevOpsExpertService.ts       6 patterns
│  ├─ ScalabilityExpertService.ts  6 patterns
│  ├─ SmartSeverityService.ts      Context-aware severity
│  ├─ IssueRelationshipService.ts  Dependencies
│  ├─ LogicBasedRemediationService.ts  Remediation rules
│  ├─ AutoFixService.ts            Auto-fix engine
│  ├─ ExplanationService.ts        Knowledge base
│  └─ SecretDetectionService.ts    Secrets
├─ views/
│  └─ IssueTreeProvider.ts         Sidebar
├─ types/
│  ├─ expert-issues.ts
│  ├─ autofix.ts
│  ├─ relationships.ts
│  └─ severity.ts
└─ cli/
   └─ ArisSecureCLI.ts             CLI tool
```

## Adding a New Service

1. Create `src/services/MyService.ts`
2. Implement detection logic, return `ExpertIssue[]`
3. Add tests in `tests/unit/MyService.test.ts`
4. Wire into `extension.ts`

Example:
```typescript
export class MyService {
  detect(code: string): ExpertIssue[] {
    const issues: ExpertIssue[] = []
    
    if (/* pattern found */) {
      issues.push({
        id: 'MY_ISSUE',
        domain: 'Quality',
        severity: 'high',
        title: 'My Issue',
        message: 'Description',
        line: lineNumber,
        explanation: { /* ... */ }
      })
    }
    
    return issues
  }
}
```

## Debugging

### In VSCode
1. Set breakpoint
2. F5 to launch with debugger
3. Interact with extension
4. Breakpoint hits

### Console Output
```typescript
console.log('Debug:', variable)
// Check Extension Development Host console
```

## Before Committing

```bash
npm test      # All green?
npm run lint  # No errors?
npm run build # Clean build?
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Extension won't load" | npm run build, then F5 |
| "Tests failing" | npm install, npm test -- --verbose |
| "TypeScript errors" | npx tsc --noEmit |
| "Module not found" | npm install --force |

## Performance

Monitor:
- Scan time (should be < 1s for typical file)
- Memory usage (should be < 50MB)
- Build time (should be < 5s)

Profile:
```bash
time npm run build
```

## Git Workflow

```bash
git checkout -b feature/my-feature
# Make changes
npm test  # All pass?
git add .
git commit -m "feat: add my feature"
git push
# Create PR
```

## See Also

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
- [README.md](./README.md) — Feature overview
- [USAGE.md](./USAGE.md) — User guide
