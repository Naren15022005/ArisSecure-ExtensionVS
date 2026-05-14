import { SmartSeverityService } from '../../src/services/SmartSeverityService';
import type { SeverityContext } from '../../src/services/SmartSeverityService';

const svc = new SmartSeverityService();

describe('SmartSeverityService.adjust', () => {
  it('never downgrades critical security issues', () => {
    const ctx: SeverityContext = { inTest: true, hasFallback: true };
    expect(svc.adjust('SQL_INJECTION', ctx)).toBe('critical');
    expect(svc.adjust('XSS', ctx)).toBe('critical');
    expect(svc.adjust('EVAL_USE', ctx)).toBe('critical');
  });

  it('downgrades issues found in test code', () => {
    const ctx: SeverityContext = { inTest: true };
    expect(svc.adjust('SEQUENTIAL_ASYNC', ctx)).toBe('medium');
    expect(svc.adjust('EMPTY_CATCH', ctx)).toBe('low');
  });

  it('upgrades SEQUENTIAL_ASYNC to critical in large unbounded loop', () => {
    const ctx: SeverityContext = { inLoop: true, loopBounded: false, loopIterations: 2000 };
    expect(svc.adjust('SEQUENTIAL_ASYNC', ctx)).toBe('critical');
  });

  it('keeps SEQUENTIAL_ASYNC at high in small loop', () => {
    const ctx: SeverityContext = { inLoop: true, loopBounded: false, loopIterations: 50 };
    expect(svc.adjust('SEQUENTIAL_ASYNC', ctx)).toBe('high');
  });

  it('upgrades N_PLUS_ONE to critical in unbounded loop', () => {
    const ctx: SeverityContext = { inLoop: true, loopBounded: false };
    expect(svc.adjust('N_PLUS_ONE', ctx)).toBe('critical');
  });

  it('downgrades when fallback is present', () => {
    const ctx: SeverityContext = { hasFallback: true };
    const base = svc.adjust('SEQUENTIAL_ASYNC', {});
    const adjusted = svc.adjust('SEQUENTIAL_ASYNC', ctx);
    const ranks = { low: 0, medium: 1, high: 2, critical: 3 };
    expect(ranks[adjusted]).toBeLessThan(ranks[base]);
  });

  it('downgrades when retry logic is present', () => {
    const ctx: SeverityContext = { hasRetry: true };
    const base = svc.adjust('MISSING_TIMEOUT', {});
    const adjusted = svc.adjust('MISSING_TIMEOUT', ctx);
    const ranks = { low: 0, medium: 1, high: 2, critical: 3 };
    expect(ranks[adjusted]).toBeLessThan(ranks[base]);
  });

  it('returns original severity when no context applies', () => {
    expect(svc.adjust('NO_PAGINATION', {})).toBe('medium');
  });
});

describe('SmartSeverityService.analyzeContext', () => {
  it('detects loop context', () => {
    const code = 'for (const id of ids) {\n  await fetch(url);\n}';
    const ctx = svc.analyzeContext(code, 2);
    expect(ctx.inLoop).toBe(true);
  });

  it('detects test code from describe/it keywords', () => {
    const code = 'describe("suite", () => {\n  it("test", () => {\n    expect(true).toBe(true);\n  });\n});';
    const ctx = svc.analyzeContext(code, 2);
    expect(ctx.inTest).toBe(true);
  });

  it('detects catch as fallback', () => {
    const code = 'try {\n  await doSomething();\n} catch (err) {\n  return fallback;\n}';
    const ctx = svc.analyzeContext(code, 2);
    expect(ctx.hasFallback).toBe(true);
  });

  it('returns false for inLoop on clean code', () => {
    const code = 'const result = await Promise.all(items.map(fn));';
    const ctx = svc.analyzeContext(code, 1);
    expect(ctx.inLoop).toBe(false);
  });
});

describe('SmartSeverityService.explain', () => {
  it('returns no-change message when severity unchanged', () => {
    const msg = svc.explain('SQL_INJECTION', 'critical', 'critical', {});
    expect(msg).toContain('no context adjustment');
  });

  it('includes downgrade reason for test context', () => {
    const msg = svc.explain('SEQUENTIAL_ASYNC', 'high', 'medium', { inTest: true });
    expect(msg).toContain('Downgraded');
    expect(msg).toContain('test code');
  });

  it('includes upgrade reason for large loop', () => {
    const msg = svc.explain('SEQUENTIAL_ASYNC', 'high', 'critical', { inLoop: true, loopIterations: 2000 });
    expect(msg).toContain('Upgraded');
  });
});
