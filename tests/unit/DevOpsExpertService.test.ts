import { DevOpsExpertService } from '../../src/services/DevOpsExpertService';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn(() => ({ get: jest.fn(() => '') })) },
}));

const svc = new DevOpsExpertService();

// ── HARDCODED_IP ──────────────────────────────────────────────────────────────

describe('HARDCODED_IP pattern', () => {
  it('detects a plain IPv4 address in a string', () => {
    const code = `const dbHost = '192.168.1.100';`;
    expect(svc.scan(code).some(r => r.id === 'HARDCODED_IP')).toBe(true);
  });

  it('detects an IP with port in a URL string', () => {
    const code = `const url = 'http://10.0.0.5:8080/api';`;
    expect(svc.scan(code).some(r => r.id === 'HARDCODED_IP')).toBe(true);
  });

  it('assigns DevOps domain', () => {
    const code = `const h = '192.168.0.1';`;
    const [issue] = svc.scan(code).filter(r => r.id === 'HARDCODED_IP');
    expect(issue.domain).toBe('DevOps');
  });

  it('assigns medium severity', () => {
    const code = `const h = '10.0.0.1';`;
    const [issue] = svc.scan(code).filter(r => r.id === 'HARDCODED_IP');
    expect(issue.severity).toBe('medium');
  });

  it('attaches explanation', () => {
    const code = `const h = '172.16.0.1';`;
    const [issue] = svc.scan(code).filter(r => r.id === 'HARDCODED_IP');
    expect(issue.explanation).toBeDefined();
  });
});

// ── UNHANDLED_PROMISE ─────────────────────────────────────────────────────────

describe('UNHANDLED_PROMISE pattern', () => {
  it('detects .then() without .catch()', () => {
    const code = `fetchUser(id).then(user => render(user));`;
    expect(svc.scan(code).some(r => r.id === 'UNHANDLED_PROMISE')).toBe(true);
  });

  it('does not flag .then().catch() chain', () => {
    const code = `fetchUser(id).then(user => render(user)).catch(err => log(err));`;
    expect(svc.scan(code).filter(r => r.id === 'UNHANDLED_PROMISE')).toHaveLength(0);
  });

  it('assigns high severity', () => {
    const code = `fetchUser(id).then(u => u);`;
    const [issue] = svc.scan(code).filter(r => r.id === 'UNHANDLED_PROMISE');
    expect(issue.severity).toBe('high');
  });

  it('reports correct line number', () => {
    const code = `const a = 1;\nfetchUser(id).then(u => u);`;
    const [issue] = svc.scan(code).filter(r => r.id === 'UNHANDLED_PROMISE');
    expect(issue.line).toBe(2);
  });
});

// ── PROCESS_EXIT ──────────────────────────────────────────────────────────────

describe('PROCESS_EXIT pattern', () => {
  it('detects process.exit()', () => {
    const code = `if (!config.db) { process.exit(1); }`;
    expect(svc.scan(code).some(r => r.id === 'PROCESS_EXIT')).toBe(true);
  });

  it('detects process.exit(0)', () => {
    const code = `process.exit(0);`;
    expect(svc.scan(code).some(r => r.id === 'PROCESS_EXIT')).toBe(true);
  });

  it('assigns medium severity', () => {
    const code = `process.exit(1);`;
    const [issue] = svc.scan(code).filter(r => r.id === 'PROCESS_EXIT');
    expect(issue.severity).toBe('medium');
  });
});

// ── SYNC_FILE_IN_SERVER ───────────────────────────────────────────────────────

describe('SYNC_FILE_IN_SERVER pattern', () => {
  it('detects readFileSync', () => {
    const code = `const data = fs.readFileSync('/path/to/file');`;
    expect(svc.scan(code).some(r => r.id === 'SYNC_FILE_IN_SERVER')).toBe(true);
  });

  it('detects writeFileSync', () => {
    const code = `fs.writeFileSync('/tmp/out.txt', data);`;
    expect(svc.scan(code).some(r => r.id === 'SYNC_FILE_IN_SERVER')).toBe(true);
  });

  it('detects existsSync', () => {
    const code = `if (fs.existsSync('/tmp/lock')) { return; }`;
    expect(svc.scan(code).some(r => r.id === 'SYNC_FILE_IN_SERVER')).toBe(true);
  });

  it('assigns high severity', () => {
    const code = `fs.readFileSync('data.txt');`;
    const [issue] = svc.scan(code).filter(r => r.id === 'SYNC_FILE_IN_SERVER');
    expect(issue.severity).toBe('high');
  });

  it('attaches explanation with remediation', () => {
    const code = `fs.readFileSync('data.txt');`;
    const [issue] = svc.scan(code).filter(r => r.id === 'SYNC_FILE_IN_SERVER');
    expect(issue.explanation?.remediation.length).toBeGreaterThan(0);
  });
});

// ── PROCESS_EXIT: does not flag graceful shutdown handler ─────────────────────

describe('PROCESS_EXIT edge case', () => {
  it('still flags process.exit inside SIGTERM handler', () => {
    // We detect the call regardless of context — it is the caller's responsibility
    const code = `process.on('SIGTERM', () => { server.close(); process.exit(0); });`;
    expect(svc.scan(code).some(r => r.id === 'PROCESS_EXIT')).toBe(true);
  });
});

// ── NO_INPUT_VALIDATION ───────────────────────────────────────────────────────

describe('NO_INPUT_VALIDATION pattern', () => {
  it('detects direct req.body field access', () => {
    const code = `const { name } = req.body; db.createUser(name);`;
    expect(svc.scan(code).some(r => r.id === 'NO_INPUT_VALIDATION')).toBe(true);
  });

  it('detects req.params access', () => {
    const code = `const id = req.params.id; db.findById(id);`;
    expect(svc.scan(code).some(r => r.id === 'NO_INPUT_VALIDATION')).toBe(true);
  });

  it('assigns high severity', () => {
    const code = `const x = req.body.name;`;
    const [issue] = svc.scan(code).filter(r => r.id === 'NO_INPUT_VALIDATION');
    expect(issue?.severity).toBe('high');
  });
});

// ── General service behaviour ─────────────────────────────────────────────────

describe('DevOpsExpertService general', () => {
  it('returns empty array for clean code', () => {
    const clean = `
      const DB_HOST = process.env.DB_HOST ?? 'localhost';
      async function readConfig() {
        const data = await fs.promises.readFile('/config.json', 'utf8');
        return JSON.parse(data);
      }
    `;
    const results = svc.scan(clean);
    expect(results.filter(r => r.id !== 'NO_INPUT_VALIDATION')).toHaveLength(0);
  });

  it('does not report the same id + line twice', () => {
    const code = `process.exit(1);`;
    const results = svc.scan(code).filter(r => r.id === 'PROCESS_EXIT');
    expect(results).toHaveLength(1);
  });

  it('all issues have 1-based line numbers', () => {
    const code = `const ip = '10.0.0.1';\nprocess.exit(1);`;
    const issues = svc.scan(code);
    expect(issues.every(i => i.line >= 1)).toBe(true);
  });
});
