import { IssueRelationshipService } from '../../src/services/IssueRelationshipService';

const svc = new IssueRelationshipService();

describe('IssueRelationshipService.findRelationships', () => {
  it('returns relationships where issueId is the source', () => {
    const rels = svc.findRelationships('SEQUENTIAL_ASYNC');
    expect(rels.length).toBeGreaterThan(0);
    rels.forEach(r => expect(r.fromIssueId).toBe('SEQUENTIAL_ASYNC'));
  });

  it('SEQUENTIAL_ASYNC blocks N_PLUS_ONE', () => {
    const rels = svc.findRelationships('SEQUENTIAL_ASYNC');
    expect(rels.some(r => r.toIssueId === 'N_PLUS_ONE' && r.type === 'BLOCKS')).toBe(true);
  });

  it('SQL_INJECTION is caused by NO_INPUT_VALIDATION', () => {
    const rels = svc.findRelationships('SQL_INJECTION');
    expect(rels.some(r => r.toIssueId === 'NO_INPUT_VALIDATION' && r.type === 'CAUSED_BY')).toBe(true);
  });

  it('DEBUG_ENABLED causes SENSITIVE_DATA_LOG', () => {
    const rels = svc.findRelationships('DEBUG_ENABLED');
    expect(rels.some(r => r.toIssueId === 'SENSITIVE_DATA_LOG' && r.type === 'CAUSES')).toBe(true);
  });

  it('returns empty array for unknown issue', () => {
    expect(svc.findRelationships('UNKNOWN_ISSUE')).toHaveLength(0);
  });
});

describe('IssueRelationshipService.calculateOptimalFixOrder', () => {
  it('places SEQUENTIAL_ASYNC before N_PLUS_ONE', () => {
    const order = svc.calculateOptimalFixOrder(['N_PLUS_ONE', 'SEQUENTIAL_ASYNC']);
    const seqIdx = order.indexOf('SEQUENTIAL_ASYNC');
    const nIdx = order.indexOf('N_PLUS_ONE');
    expect(seqIdx).toBeLessThan(nIdx);
  });

  it('places NO_INPUT_VALIDATION before SQL_INJECTION', () => {
    const order = svc.calculateOptimalFixOrder(['SQL_INJECTION', 'NO_INPUT_VALIDATION']);
    const valIdx = order.indexOf('NO_INPUT_VALIDATION');
    const sqlIdx = order.indexOf('SQL_INJECTION');
    expect(valIdx).toBeLessThan(sqlIdx);
  });

  it('returns all input IDs in result', () => {
    const ids = ['SEQUENTIAL_ASYNC', 'N_PLUS_ONE', 'SQL_INJECTION', 'CONSOLE_LOG'];
    const order = svc.calculateOptimalFixOrder(ids);
    expect(order.sort()).toEqual(ids.sort());
  });

  it('handles a single issue', () => {
    expect(svc.calculateOptimalFixOrder(['CONSOLE_LOG'])).toEqual(['CONSOLE_LOG']);
  });

  it('handles empty input', () => {
    expect(svc.calculateOptimalFixOrder([])).toEqual([]);
  });

  it('does not crash on unrelated issues (no edges)', () => {
    const ids = ['CONSOLE_LOG', 'TODO_FIXME', 'MAGIC_NUMBER'];
    const order = svc.calculateOptimalFixOrder(ids);
    expect(order).toHaveLength(3);
  });
});

describe('IssueRelationshipService.explain', () => {
  it('produces human-readable explanation for BLOCKS', () => {
    const rel = svc.findRelationships('SEQUENTIAL_ASYNC').find(r => r.type === 'BLOCKS')!;
    const text = svc.explain(rel);
    expect(text).toContain('SEQUENTIAL_ASYNC');
    expect(text).toContain('blocks');
    expect(text).toContain('N_PLUS_ONE');
  });

  it('produces human-readable explanation for CAUSED_BY', () => {
    const rel = svc.findRelationships('SQL_INJECTION').find(r => r.type === 'CAUSED_BY')!;
    const text = svc.explain(rel);
    expect(text).toContain('is caused by');
  });
});

describe('IssueRelationshipService.generateReport', () => {
  it('includes all issue IDs in the report', () => {
    const ids = ['SEQUENTIAL_ASYNC', 'N_PLUS_ONE'];
    const report = svc.generateReport(ids);
    expect(report).toContain('SEQUENTIAL_ASYNC');
    expect(report).toContain('N_PLUS_ONE');
  });

  it('shows optimal fix order header', () => {
    const report = svc.generateReport(['SQL_INJECTION', 'NO_INPUT_VALIDATION']);
    expect(report).toContain('Optimal Fix Order');
  });

  it('includes issue count in footer', () => {
    const ids = ['CONSOLE_LOG', 'TODO_FIXME'];
    const report = svc.generateReport(ids);
    expect(report).toContain('2 issue(s)');
  });

  it('returns non-empty report for empty input', () => {
    const report = svc.generateReport([]);
    expect(typeof report).toBe('string');
  });
});
