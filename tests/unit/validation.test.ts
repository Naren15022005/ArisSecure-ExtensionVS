import { validatePrompt } from '../../src/utils/validation';

describe('validatePrompt', () => {
  it('accepts valid prompt', () => {
    expect(() => validatePrompt('Create a REST API endpoint')).not.toThrow();
  });

  it('rejects prompt shorter than 10 chars', () => {
    expect(() => validatePrompt('short')).toThrow('al menos 10');
  });

  it('rejects empty string', () => {
    expect(() => validatePrompt('')).toThrow();
  });

  it('rejects prompt over 1000 chars', () => {
    expect(() => validatePrompt('a'.repeat(1001))).toThrow('1000');
  });

  it('trims before checking length', () => {
    expect(() => validatePrompt('   hi   ')).toThrow();
  });
});
