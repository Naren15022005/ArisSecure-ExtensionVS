import { LogicBasedRemediationService } from '../../src/services/LogicBasedRemediationService';
import type { SeverityContext } from '../../src/services/SmartSeverityService';

const svc = new LogicBasedRemediationService();

describe('LogicBasedRemediationService.suggestFix', () => {
  describe('Security rules', () => {
    it('suggests fix for SQL_INJECTION', () => {
      const s = svc.suggestFix('SQL_INJECTION');
      expect(s).not.toBeNull();
      expect(s!.severity).toBe('Critical');
      expect(s!.confidence).toBe('CRITICAL');
      expect(s!.suggestedCodeGood).toContain('?');
      expect(s!.steps.length).toBeGreaterThan(0);
    });

    it('suggests fix for XSS', () => {
      const s = svc.suggestFix('XSS');
      expect(s!.severity).toBe('Critical');
      expect(s!.suggestedCodeGood).toContain('DOMPurify');
    });

    it('suggests fix for PASSWORD with envVarNeeded', () => {
      const s = svc.suggestFix('PASSWORD');
      expect(s!.envVarNeeded).toBe('DB_PASSWORD');
      expect(s!.suggestedCodeGood).toContain('process.env');
    });

    it('suggests fix for API_KEY with envVarNeeded', () => {
      const s = svc.suggestFix('API_KEY');
      expect(s!.envVarNeeded).toBe('API_KEY');
    });

    it('suggests fix for AWS_ACCESS_KEY with multiple env vars', () => {
      const s = svc.suggestFix('AWS_ACCESS_KEY');
      expect(s!.envVarNeeded).toContain('AWS_ACCESS_KEY_ID');
      expect(s!.steps.length).toBeGreaterThanOrEqual(5);
    });

    it('suggests fix for COMMAND_INJECTION', () => {
      const s = svc.suggestFix('COMMAND_INJECTION');
      expect(s!.confidence).toBe('CRITICAL');
      expect(s!.suggestedCodeGood).toContain('execFile');
    });

    it('suggests fix for DANGEROUS_HTML', () => {
      const s = svc.suggestFix('DANGEROUS_HTML');
      expect(s!.relatedIssues).toContain('XSS');
    });
  });

  describe('Quality rules', () => {
    it('suggests fix for CONSOLE_LOG', () => {
      const s = svc.suggestFix('CONSOLE_LOG');
      expect(s!.severity).toBe('Medium');
      expect(s!.currentCodeBad).toContain('console.log');
    });

    it('suggests fix for EMPTY_CATCH', () => {
      const s = svc.suggestFix('EMPTY_CATCH');
      expect(s!.severity).toBe('High');
      expect(s!.suggestedCodeGood).toContain('logger.error');
    });

    it('suggests fix for TODO_FIXME', () => {
      const s = svc.suggestFix('TODO_FIXME');
      expect(s!.severity).toBe('Low');
    });

    it('suggests fix for MAGIC_NUMBER', () => {
      const s = svc.suggestFix('MAGIC_NUMBER');
      expect(s!.suggestedCodeGood).toContain('LEGAL_AGE');
    });
  });

  describe('Scalability rules', () => {
    it('suggests fix for N_PLUS_ONE', () => {
      const s = svc.suggestFix('N_PLUS_ONE');
      expect(s!.severity).toBe('High');
      expect(s!.suggestedCodeGood).toContain('IN');
    });

    it('calculates total performance gain from loop iterations', () => {
      const ctx: SeverityContext = { inLoop: true, loopIterations: 1000 };
      const s = svc.suggestFix('N_PLUS_ONE', ctx);
      // 1000 iterations × 0.45ms base = 450ms
      expect(s!.performanceGainMs).toBeCloseTo(450, 1);
    });

    it('suggests fix for SEQUENTIAL_ASYNC', () => {
      const s = svc.suggestFix('SEQUENTIAL_ASYNC');
      expect(s!.suggestedCodeGood).toContain('Promise.all');
    });

    it('suggests fix for NO_PAGINATION', () => {
      const s = svc.suggestFix('NO_PAGINATION');
      expect(s!.suggestedCodeGood).toContain('LIMIT');
    });

    it('suggests fix for NESTED_LOOP', () => {
      const s = svc.suggestFix('NESTED_LOOP');
      expect(s!.suggestedCodeGood).toContain('Map');
    });

    it('suggests fix for UNBOUNDED_CACHE', () => {
      const s = svc.suggestFix('UNBOUNDED_CACHE');
      expect(s!.suggestedCodeGood).toContain('LRU');
    });
  });

  describe('DevOps rules', () => {
    it('suggests fix for UNHANDLED_PROMISE', () => {
      const s = svc.suggestFix('UNHANDLED_PROMISE');
      expect(s!.severity).toBe('High');
      expect(s!.suggestedCodeGood).toContain('catch');
    });

    it('suggests fix for MISSING_TIMEOUT', () => {
      const s = svc.suggestFix('MISSING_TIMEOUT');
      expect(s!.suggestedCodeGood).toContain('timeout');
    });

    it('suggests fix for HARDCODED_IP', () => {
      const s = svc.suggestFix('HARDCODED_IP');
      expect(s!.suggestedCodeGood).toContain('process.env');
    });

    it('suggests fix for SENSITIVE_DATA_LOG', () => {
      const s = svc.suggestFix('SENSITIVE_DATA_LOG');
      expect(s!.relatedIssues).toContain('CONSOLE_LOG');
    });
  });

  describe('Context adjustments', () => {
    it('reduces fix time for issues in test files', () => {
      const base = svc.suggestFix('EMPTY_CATCH')!.estimatedFixTimeMinutes;
      const inTest = svc.suggestFix('EMPTY_CATCH', { inTest: true })!.estimatedFixTimeMinutes;
      expect(inTest).toBeLessThan(base);
    });

    it('applies performance gain multiplication only when loopIterations is set', () => {
      const noCtx = svc.suggestFix('N_PLUS_ONE')!;
      const withCtx = svc.suggestFix('N_PLUS_ONE', { loopIterations: 500 })!;
      expect(withCtx.performanceGainMs).toBeGreaterThan(noCtx.performanceGainMs!);
    });
  });

  describe('Unknown issue', () => {
    it('returns null for unrecognised issue ids', () => {
      expect(svc.suggestFix('TOTALLY_UNKNOWN_RULE')).toBeNull();
    });
  });
});

describe('LogicBasedRemediationService.getAllRuleIds', () => {
  it('returns all registered rule IDs', () => {
    const ids = svc.getAllRuleIds();
    expect(ids.length).toBeGreaterThanOrEqual(15);
    expect(ids).toContain('SQL_INJECTION');
    expect(ids).toContain('N_PLUS_ONE');
    expect(ids).toContain('CONSOLE_LOG');
  });
});

describe('LogicBasedRemediationService.getRulesByDomain', () => {
  it('returns security rules for Security domain', () => {
    const ids = svc.getRulesByDomain('Security');
    expect(ids).toContain('SQL_INJECTION');
    expect(ids).toContain('XSS');
  });

  it('returns scalability rules for Scalability domain', () => {
    const ids = svc.getRulesByDomain('Scalability');
    expect(ids).toContain('N_PLUS_ONE');
    expect(ids).toContain('SEQUENTIAL_ASYNC');
  });

  it('returns empty array for unknown domain', () => {
    expect(svc.getRulesByDomain('Blockchain')).toHaveLength(0);
  });
});
