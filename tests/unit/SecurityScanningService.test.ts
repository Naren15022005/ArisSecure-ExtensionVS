import { SecurityScanningService } from '../../src/services/SecurityScanningService';

// No Semgrep token + no CLI → falls back to pattern detection
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(''),
    }),
  },
}));

jest.mock('child_process', () => ({
  exec: jest.fn((_cmd: string, _opts: unknown, cb: (err: Error) => void) =>
    cb(new Error('semgrep not installed'))
  ),
}));

const svc = new SecurityScanningService();

describe('SecurityScanningService — semgrep unavailable', () => {
  it('does not throw when all scanners fail', async () => {
    await expect(svc.scan('any code')).resolves.not.toThrow();
  });

  it('returns empty array for clean code', async () => {
    const result = await svc.scan('function add(a, b) { return a + b; }');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe('SecurityScanningService — built-in pattern detection', () => {
  it('detects SQL injection via string concatenation', async () => {
    const code = `const q = "SELECT * FROM users WHERE id = " + userId;`;
    const result = await svc.scan(code);
    expect(result.some(v => v.ruleId === 'SQL_INJECTION')).toBe(true);
  });

  it('detects eval() usage', async () => {
    const result = await svc.scan('eval(userInput);');
    expect(result.some(v => v.ruleId === 'EVAL_USAGE')).toBe(true);
  });

  it('detects innerHTML assignment', async () => {
    const result = await svc.scan('el.innerHTML = userComment;');
    expect(result.some(v => v.ruleId === 'XSS_INNER_HTML')).toBe(true);
  });

  it('detects MD5 weak crypto', async () => {
    const result = await svc.scan(`const h = createHash('md5').update(data).digest('hex');`);
    expect(result.some(v => v.ruleId === 'WEAK_CRYPTO')).toBe(true);
  });

  it('detects Math.random() insecure randomness', async () => {
    const result = await svc.scan('const token = Math.random().toString(36);');
    expect(result.some(v => v.ruleId === 'INSECURE_RANDOM')).toBe(true);
  });

  it('detected vulnerabilities carry an explanation', async () => {
    const result = await svc.scan('eval(userInput);');
    const evalIssue = result.find(v => v.ruleId === 'EVAL_USAGE');
    expect(evalIssue?.explanation).toBeDefined();
    expect(evalIssue?.explanation?.risks.length).toBeGreaterThan(0);
    expect(evalIssue?.explanation?.remediation.length).toBeGreaterThan(0);
  });

  it('does not duplicate issues for same rule on same line', async () => {
    // Two eval calls on the same line
    const result = await svc.scan('eval(a); eval(b);');
    const evalResults = result.filter(v => v.ruleId === 'EVAL_USAGE');
    const lines = evalResults.map(v => v.line);
    const uniqueLines = new Set(lines);
    expect(uniqueLines.size).toBe(lines.length);
  });

  it('reports correct line number for multi-line code', async () => {
    const code = `const x = 1;\nconst q = "SELECT * FROM users WHERE id = " + id;\nconst y = 2;`;
    const result = await svc.scan(code);
    const sqli = result.find(v => v.ruleId === 'SQL_INJECTION');
    expect(sqli?.line).toBe(2);
  });
});
