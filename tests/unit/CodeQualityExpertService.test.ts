import { CodeQualityExpertService } from '../../src/services/CodeQualityExpertService';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn(() => ({ get: jest.fn(() => '') })) },
}));

const svc = new CodeQualityExpertService();

// ── EMPTY_CATCH ───────────────────────────────────────────────────────────────

describe('EMPTY_CATCH pattern', () => {
  it('detects a bare empty catch block', () => {
    const code = `try { doSomething(); } catch (e) {}`;
    const results = svc.scan(code);
    expect(results.some(r => r.id === 'EMPTY_CATCH')).toBe(true);
  });

  it('detects an empty catch with only a comment', () => {
    const code = `try { foo(); } catch (err) { // ignore }`;
    const results = svc.scan(code);
    expect(results.some(r => r.id === 'EMPTY_CATCH')).toBe(true);
  });

  it('does not flag a catch that logs the error', () => {
    const code = `try { foo(); } catch (err) { logger.error(err); }`;
    const results = svc.scan(code);
    expect(results.find(r => r.id === 'EMPTY_CATCH')).toBeUndefined();
  });

  it('assigns Quality domain', () => {
    const code = `try { x(); } catch (e) {}`;
    const [issue] = svc.scan(code).filter(r => r.id === 'EMPTY_CATCH');
    expect(issue.domain).toBe('Quality');
  });

  it('assigns high severity', () => {
    const code = `try { x(); } catch (e) {}`;
    const [issue] = svc.scan(code).filter(r => r.id === 'EMPTY_CATCH');
    expect(issue.severity).toBe('high');
  });

  it('attaches ExplanationData when available', () => {
    const code = `try { x(); } catch (e) {}`;
    const [issue] = svc.scan(code).filter(r => r.id === 'EMPTY_CATCH');
    expect(issue.explanation).toBeDefined();
    expect(issue.explanation!.remediation.length).toBeGreaterThan(0);
  });
});

// ── CONSOLE_LOG ───────────────────────────────────────────────────────────────

describe('CONSOLE_LOG pattern', () => {
  it('detects console.log()', () => {
    const code = `console.log('User logged in', userId);`;
    expect(svc.scan(code).some(r => r.id === 'CONSOLE_LOG')).toBe(true);
  });

  it('detects console.debug()', () => {
    const code = `console.debug('state:', state);`;
    expect(svc.scan(code).some(r => r.id === 'CONSOLE_LOG')).toBe(true);
  });

  it('detects console.info()', () => {
    const code = `console.info('Server started');`;
    expect(svc.scan(code).some(r => r.id === 'CONSOLE_LOG')).toBe(true);
  });

  it('does not flag console.error or console.warn', () => {
    const code = `console.error('fatal'); console.warn('notice');`;
    expect(svc.scan(code).filter(r => r.id === 'CONSOLE_LOG')).toHaveLength(0);
  });

  it('reports correct line number', () => {
    const code = `const x = 1;\nconsole.log(x);`;
    const [issue] = svc.scan(code).filter(r => r.id === 'CONSOLE_LOG');
    expect(issue.line).toBe(2);
  });
});

// ── TODO_FIXME ────────────────────────────────────────────────────────────────

describe('TODO_FIXME pattern', () => {
  it('detects // TODO comment', () => {
    const code = `// TODO: validate user input`;
    expect(svc.scan(code).some(r => r.id === 'TODO_FIXME')).toBe(true);
  });

  it('detects // FIXME comment', () => {
    const code = `// FIXME: SQL injection possible here`;
    expect(svc.scan(code).some(r => r.id === 'TODO_FIXME')).toBe(true);
  });

  it('detects // HACK comment', () => {
    const code = `// HACK: temporary workaround`;
    expect(svc.scan(code).some(r => r.id === 'TODO_FIXME')).toBe(true);
  });

  it('is case-insensitive for todo', () => {
    const code = `// todo: something`;
    expect(svc.scan(code).some(r => r.id === 'TODO_FIXME')).toBe(true);
  });

  it('does not flag a normal comment', () => {
    const code = `// This is a regular comment`;
    expect(svc.scan(code).filter(r => r.id === 'TODO_FIXME')).toHaveLength(0);
  });
});

// ── TOO_MANY_PARAMS ───────────────────────────────────────────────────────────

describe('TOO_MANY_PARAMS pattern', () => {
  it('detects a function with 5 parameters', () => {
    const code = `function createUser(name, email, phone, address, role) {}`;
    expect(svc.scan(code).some(r => r.id === 'TOO_MANY_PARAMS')).toBe(true);
  });

  it('detects an arrow function with 5+ parameters', () => {
    const code = `const fn = (a, b, c, d, e) => a + b;`;
    expect(svc.scan(code).some(r => r.id === 'TOO_MANY_PARAMS')).toBe(true);
  });

  it('does not flag a function with 4 parameters', () => {
    const code = `function updateUser(name, email, phone, role) {}`;
    expect(svc.scan(code).filter(r => r.id === 'TOO_MANY_PARAMS')).toHaveLength(0);
  });
});

// ── DEEP_NESTING ──────────────────────────────────────────────────────────────

describe('DEEP_NESTING pattern', () => {
  it('detects 4-level deep if', () => {
    const code =
      'if (a) {\n' +
      '  if (b) {\n' +
      '    if (c) {\n' +
      '        if (d) { doSomething(); }\n' +
      '    }\n' +
      '  }\n' +
      '}';
    expect(svc.scan(code).some(r => r.id === 'DEEP_NESTING')).toBe(true);
  });

  it('does not flag 2-level nesting', () => {
    const code = 'if (a) {\n  if (b) {\n    doSomething();\n  }\n}';
    expect(svc.scan(code).filter(r => r.id === 'DEEP_NESTING')).toHaveLength(0);
  });
});

// ── POOR_NAMING ───────────────────────────────────────────────────────────────

describe('POOR_NAMING pattern', () => {
  it('detects single-character variable name', () => {
    const code = `const x = getData();`;
    expect(svc.scan(code).some(r => r.id === 'POOR_NAMING')).toBe(true);
  });

  it('detects single-char let', () => {
    const code = `let d = new Date();`;
    expect(svc.scan(code).some(r => r.id === 'POOR_NAMING')).toBe(true);
  });

  it('does not flag multi-character names', () => {
    const code = `const data = getData();`;
    expect(svc.scan(code).filter(r => r.id === 'POOR_NAMING')).toHaveLength(0);
  });
});

// ── General service behaviour ─────────────────────────────────────────────────

describe('CodeQualityExpertService general', () => {
  it('returns empty array for clean code', () => {
    const clean = `
      async function fetchUser(userId: string): Promise<User> {
        try {
          const user = await db.findOne({ where: { id: userId } });
          return user;
        } catch (error) {
          logger.error('Failed to fetch user', { userId, error });
          throw new DatabaseError('User lookup failed', { cause: error });
        }
      }
    `;
    expect(svc.scan(clean)).toHaveLength(0);
  });

  it('does not report the same id + line twice', () => {
    const code = `try { x(); } catch (e) {}`;
    const results = svc.scan(code).filter(r => r.id === 'EMPTY_CATCH');
    expect(results).toHaveLength(1);
  });

  it('issue line numbers are 1-based', () => {
    const code = `const x = 1;\nconsole.log(x);\nconst y = 2;`;
    const issues = svc.scan(code);
    expect(issues.every(i => i.line >= 1)).toBe(true);
  });
});
