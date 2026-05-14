import { AutoFixService } from '../../src/services/AutoFixService';
import type { IssueData } from '../../src/views/IssueTreeProvider';

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({ get: jest.fn(() => '') })),
    applyEdit: jest.fn(() => Promise.resolve(true)),
  },
  WorkspaceEdit: jest.fn().mockImplementation(() => ({
    replace: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  })),
  Position: jest.fn(),
  Range: jest.fn(),
  Uri: { parse: jest.fn((s: string) => s) },
}));

const svc = new AutoFixService();

function makeIssue(overrides: Partial<IssueData>): IssueData {
  return {
    type: 'vulnerability',
    domain: 'Security',
    title: 'UNKNOWN',
    message: 'test issue',
    line: 5,
    severity: 'medium',
    ...overrides,
  };
}

describe('AutoFixService.generateFix', () => {
  describe('secret issues', () => {
    it('returns REPLACE fix for secret type', () => {
      const issue = makeIssue({ type: 'secret', title: 'API_KEY', severity: 'critical' });
      const fix = svc.generateFix(issue);
      expect(fix).not.toBeNull();
      expect(fix!.type).toBe('REPLACE');
    });

    it('generates env variable name from issue title', () => {
      const issue = makeIssue({ type: 'secret', title: 'AWS_ACCESS_KEY', severity: 'critical' });
      const fix = svc.generateFix(issue);
      expect(fix!.replace).toContain('process.env.AWS_ACCESS_KEY');
    });

    it('requires confirmation for secret replacement', () => {
      const issue = makeIssue({ type: 'secret', title: 'PASSWORD', severity: 'critical' });
      const fix = svc.generateFix(issue);
      expect(fix!.requiresConfirmation).toBe(true);
    });

    it('sanitizes special characters in env name', () => {
      const issue = makeIssue({ type: 'secret', title: 'my-secret-key', severity: 'critical' });
      const fix = svc.generateFix(issue);
      expect(fix!.replace).toMatch(/process\.env\.[A-Z0-9_]+/);
    });
  });

  describe('CONSOLE_LOG', () => {
    it('returns DELETE fix', () => {
      const issue = makeIssue({ title: 'CONSOLE_LOG', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.type).toBe('DELETE');
    });

    it('does not require confirmation', () => {
      const issue = makeIssue({ title: 'CONSOLE_LOG', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.requiresConfirmation).toBe(false);
    });
  });

  describe('TODO_FIXME', () => {
    it('returns REPLACE fix', () => {
      const issue = makeIssue({ title: 'TODO_FIXME', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.type).toBe('REPLACE');
    });

    it('replaces with TRACKED comment', () => {
      const issue = makeIssue({ title: 'TODO_FIXME', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.replace).toContain('TRACKED');
    });
  });

  describe('EMPTY_CATCH', () => {
    it('returns REPLACE fix with error logging', () => {
      const issue = makeIssue({ title: 'EMPTY_CATCH', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.type).toBe('REPLACE');
      expect(fix!.replace).toContain('console.error');
    });
  });

  describe('SENSITIVE_DATA_LOG', () => {
    it('returns DELETE fix with confirmation', () => {
      const issue = makeIssue({ title: 'SENSITIVE_DATA_LOG', type: 'vulnerability' });
      const fix = svc.generateFix(issue);
      expect(fix!.type).toBe('DELETE');
      expect(fix!.requiresConfirmation).toBe(true);
    });
  });

  describe('DEBUG_ENABLED', () => {
    it('returns REPLACE fix gating behind NODE_ENV', () => {
      const issue = makeIssue({ title: 'DEBUG_ENABLED', type: 'vulnerability' });
      const fix = svc.generateFix(issue);
      expect(fix!.type).toBe('REPLACE');
      expect(fix!.replace).toContain('NODE_ENV');
    });
  });

  describe('unknown issue', () => {
    it('returns null for issues with no auto-fix', () => {
      const issue = makeIssue({ title: 'SOME_UNKNOWN_RULE', type: 'vulnerability' });
      expect(svc.generateFix(issue)).toBeNull();
    });
  });

  describe('fix metadata', () => {
    it('fix id includes issue title and line number', () => {
      const issue = makeIssue({ title: 'CONSOLE_LOG', type: 'quality', line: 42 });
      const fix = svc.generateFix(issue);
      expect(fix!.id).toContain('CONSOLE_LOG');
      expect(fix!.id).toContain('42');
    });

    it('fix issueId matches issue title', () => {
      const issue = makeIssue({ title: 'TODO_FIXME', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.issueId).toBe('TODO_FIXME');
    });

    it('fix has a non-empty description', () => {
      const issue = makeIssue({ title: 'CONSOLE_LOG', type: 'quality' });
      const fix = svc.generateFix(issue);
      expect(fix!.description.length).toBeGreaterThan(0);
    });
  });
});
