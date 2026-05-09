import { SecretDetectionService } from '../../src/services/SecretDetectionService';

// Force CLI to fail so pattern fallback is always used in tests
jest.mock('child_process', () => ({
  exec: jest.fn((_cmd: string, _opts: unknown, cb: (err: Error) => void) =>
    cb(new Error('truffleHog not installed'))
  ),
}));

const svc = new SecretDetectionService();

describe('SecretDetectionService — pattern fallback', () => {
  it('detects AWS access keys', async () => {
    const result = await svc.detect('const k = "AKIAIOSFODNN7EXAMPLE";');
    expect(result.some(s => s.type === 'AWS_ACCESS_KEY')).toBe(true);
  });

  it('detects hardcoded passwords', async () => {
    const result = await svc.detect(`const password = "supersecret123";`);
    expect(result.some(s => s.type === 'PASSWORD')).toBe(true);
  });

  it('detects OpenAI keys', async () => {
    const result = await svc.detect(`const key = "sk-abcdefghijklmnopqrstuvwxyz1234";`);
    expect(result.some(s => s.type === 'OPENAI_API_KEY')).toBe(true);
  });

  it('returns empty array for clean code', async () => {
    const result = await svc.detect('function add(a, b) { return a + b; }');
    expect(result).toHaveLength(0);
  });

  it('reports correct line number', async () => {
    const code = `const x = 1;\nconst password = "mysecret123";\nconst y = 2;`;
    const result = await svc.detect(code);
    const pw = result.find(s => s.type === 'PASSWORD');
    expect(pw?.line).toBe(2);
  });

  it('does not duplicate secrets on same line', async () => {
    const code = `const password = "supersecret123";`;
    const result = await svc.detect(code);
    const pws = result.filter(s => s.type === 'PASSWORD');
    expect(pws.length).toBe(1);
  });
});
