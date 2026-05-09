import { SecurityScanningService } from '../../src/services/SecurityScanningService';

// No Semgrep token + no CLI → returns []
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

describe('SecurityScanningService', () => {
  it('returns empty array when semgrep not available', async () => {
    const result = await svc.scan('function add(a, b) { return a + b; }');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('does not throw when all scanners fail', async () => {
    await expect(svc.scan('any code')).resolves.not.toThrow();
  });
});
