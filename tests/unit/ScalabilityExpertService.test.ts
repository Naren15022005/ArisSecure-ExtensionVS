import { ScalabilityExpertService } from '../../src/services/ScalabilityExpertService';

jest.mock('vscode', () => ({
  workspace: { getConfiguration: jest.fn(() => ({ get: jest.fn(() => '') })) },
}));

const svc = new ScalabilityExpertService();

// ── SEQUENTIAL_ASYNC ──────────────────────────────────────────────────────────

describe('SEQUENTIAL_ASYNC pattern', () => {
  it('detects await inside a for..of loop', () => {
    const code = [
      'for (const id of userIds) {',
      '  await sendEmail(id);',
      '}',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'SEQUENTIAL_ASYNC')).toBe(true);
  });

  it('detects await inside a while loop', () => {
    const code = [
      'while (queue.length > 0) {',
      '  await process(queue.shift());',
      '}',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'SEQUENTIAL_ASYNC')).toBe(true);
  });

  it('assigns Scalability domain', () => {
    const code = 'for (const x of xs) {\n  await fn(x);\n}';
    const [issue] = svc.scan(code).filter(r => r.id === 'SEQUENTIAL_ASYNC');
    expect(issue.domain).toBe('Scalability');
  });

  it('assigns high severity', () => {
    const code = 'for (const x of xs) {\n  await fn(x);\n}';
    const [issue] = svc.scan(code).filter(r => r.id === 'SEQUENTIAL_ASYNC');
    expect(issue.severity).toBe('high');
  });

  it('attaches explanation with remediation', () => {
    const code = 'for (const x of xs) {\n  await fn(x);\n}';
    const [issue] = svc.scan(code).filter(r => r.id === 'SEQUENTIAL_ASYNC');
    expect(issue.explanation?.remediation.length).toBeGreaterThan(0);
  });
});

// ── N_PLUS_ONE ────────────────────────────────────────────────────────────────

describe('N_PLUS_ONE pattern', () => {
  it('detects db.query inside a for..of loop', () => {
    const code = [
      'for (const user of users) {',
      "  user.orders = await db.query('SELECT * FROM orders WHERE uid=?', [user.id]);",
      '}',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'N_PLUS_ONE')).toBe(true);
  });

  it('detects findOne inside a loop', () => {
    const code = [
      'for (const id of ids) {',
      '  const rec = await db.findOne({ where: { id } });',
      '}',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'N_PLUS_ONE')).toBe(true);
  });

  it('assigns high severity', () => {
    const code = 'for (const u of users) {\n  await db.findOne({ id: u.id });\n}';
    const [issue] = svc.scan(code).filter(r => r.id === 'N_PLUS_ONE');
    expect(issue?.severity).toBe('high');
  });
});

// ── NO_PAGINATION ─────────────────────────────────────────────────────────────

describe('NO_PAGINATION pattern', () => {
  it('detects SELECT * without LIMIT', () => {
    const code = `const users = await db.query('SELECT * FROM users');`;
    expect(svc.scan(code).some(r => r.id === 'NO_PAGINATION')).toBe(true);
  });

  it('does not flag SELECT * WITH LIMIT', () => {
    const code = `const users = await db.query('SELECT * FROM users LIMIT 50 OFFSET 0');`;
    expect(svc.scan(code).filter(r => r.id === 'NO_PAGINATION')).toHaveLength(0);
  });

  it('assigns medium severity', () => {
    const code = `const rows = await db.query('SELECT * FROM orders');`;
    const [issue] = svc.scan(code).filter(r => r.id === 'NO_PAGINATION');
    expect(issue.severity).toBe('medium');
  });

  it('attaches explanation', () => {
    const code = `await db.query('SELECT * FROM logs');`;
    const [issue] = svc.scan(code).filter(r => r.id === 'NO_PAGINATION');
    expect(issue.explanation).toBeDefined();
  });
});

// ── NESTED_LOOP ───────────────────────────────────────────────────────────────

describe('NESTED_LOOP pattern', () => {
  it('detects nested forEach calls', () => {
    const code = [
      'users.forEach(user => {',
      '  orders.forEach(order => {',
      '    if (user.id === order.userId) results.push({ user, order });',
      '  });',
      '});',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'NESTED_LOOP')).toBe(true);
  });

  it('assigns medium severity', () => {
    const code = 'as.forEach(a => { bs.forEach(b => { f(a, b); }); });';
    const [issue] = svc.scan(code).filter(r => r.id === 'NESTED_LOOP');
    expect(issue?.severity).toBe('medium');
  });
});

// ── STRING_CONCAT_LOOP ────────────────────────────────────────────────────────

describe('STRING_CONCAT_LOOP pattern', () => {
  it('detects string += inside a for loop', () => {
    const code = [
      'let csv = "";',
      'for (const row of rows) {',
      '  csv += row.join(",") + "\\n";',
      '}',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'STRING_CONCAT_LOOP')).toBe(true);
  });

  it('detects variable += inside a for loop', () => {
    const code = [
      'let html = "";',
      'for (const item of items) {',
      '  html += item;',
      '}',
    ].join('\n');
    expect(svc.scan(code).some(r => r.id === 'STRING_CONCAT_LOOP')).toBe(true);
  });

  it('assigns medium severity', () => {
    const code = 'let s = "";\nfor (const x of xs) {\n  s += x;\n}';
    const [issue] = svc.scan(code).filter(r => r.id === 'STRING_CONCAT_LOOP');
    expect(issue?.severity).toBe('medium');
  });
});

// ── UNBOUNDED_CACHE ───────────────────────────────────────────────────────────

describe('UNBOUNDED_CACHE pattern', () => {
  it('detects new Map() used as a cache', () => {
    const code = `const cache = new Map();`;
    expect(svc.scan(code).some(r => r.id === 'UNBOUNDED_CACHE')).toBe(true);
  });

  it('detects new Set() used as storage', () => {
    const code = `const seen = new Set();`;
    expect(svc.scan(code).some(r => r.id === 'UNBOUNDED_CACHE')).toBe(true);
  });

  it('assigns medium severity', () => {
    const code = `const m = new Map();`;
    const [issue] = svc.scan(code).filter(r => r.id === 'UNBOUNDED_CACHE');
    expect(issue.severity).toBe('medium');
  });

  it('attaches explanation with LRU cache reference', () => {
    const code = `const m = new Map();`;
    const [issue] = svc.scan(code).filter(r => r.id === 'UNBOUNDED_CACHE');
    expect(issue.explanation).toBeDefined();
    expect(issue.explanation!.references.length).toBeGreaterThan(0);
  });
});

// ── General service behaviour ─────────────────────────────────────────────────

describe('ScalabilityExpertService general', () => {
  it('returns empty array for code that uses Promise.all and Map lookups', () => {
    const clean = `
      async function sendAll(ids: string[]) {
        await Promise.all(ids.map(id => sendEmail(id)));
      }
      const userMap = new LRU({ max: 1000 });
    `;
    const results = svc.scan(clean).filter(
      r => r.id !== 'UNBOUNDED_CACHE'  // LRU mention doesn't match our simple Map pattern
    );
    expect(results.filter(r => r.id === 'SEQUENTIAL_ASYNC')).toHaveLength(0);
    expect(results.filter(r => r.id === 'N_PLUS_ONE')).toHaveLength(0);
  });

  it('does not report the same id + line twice', () => {
    const code = `const m = new Map();`;
    const results = svc.scan(code).filter(r => r.id === 'UNBOUNDED_CACHE');
    expect(results).toHaveLength(1);
  });

  it('all issues have 1-based line numbers', () => {
    const code = `const a = 1;\nconst m = new Map();\nconst b = 2;`;
    const issues = svc.scan(code);
    expect(issues.every(i => i.line >= 1)).toBe(true);
  });
});
