import type { IssueRelationship } from '../types/relationships';

const RELATIONSHIPS: IssueRelationship[] = [
  // Sequential async causes N+1
  { fromIssueId: 'SEQUENTIAL_ASYNC', toIssueId: 'N_PLUS_ONE',       type: 'BLOCKS',     reason: 'Fix sequential async first — N+1 may resolve automatically',        priority: 1 },
  { fromIssueId: 'N_PLUS_ONE',       toIssueId: 'SEQUENTIAL_ASYNC', type: 'BLOCKED_BY', reason: 'N+1 depends on sequential async resolution',                          priority: 2 },

  // SQL injection caused by missing validation
  { fromIssueId: 'SQL_INJECTION',    toIssueId: 'NO_INPUT_VALIDATION', type: 'CAUSED_BY', reason: 'SQL injection is possible because input is not validated', priority: 1 },
  { fromIssueId: 'NO_INPUT_VALIDATION', toIssueId: 'SQL_INJECTION',   type: 'CAUSES',    reason: 'Missing validation enables SQL injection',                priority: 1 },

  // XSS and dangerous HTML
  { fromIssueId: 'XSS',             toIssueId: 'DANGEROUS_HTML',    type: 'RELATED_TO', reason: 'Both involve unsafe HTML rendering paths',                            priority: 3 },
  { fromIssueId: 'DANGEROUS_HTML',  toIssueId: 'XSS',               type: 'RELATED_TO', reason: 'Dangerous HTML can introduce XSS vulnerabilities',                    priority: 3 },

  // CORS and cookie security
  { fromIssueId: 'CORS_ALL_ORIGINS', toIssueId: 'COOKIE_INSECURE',  type: 'RELATED_TO', reason: 'Permissive CORS combined with insecure cookies expands attack surface', priority: 2 },
  { fromIssueId: 'COOKIE_INSECURE',  toIssueId: 'CORS_ALL_ORIGINS', type: 'RELATED_TO', reason: 'Insecure cookies are most dangerous with open CORS',                  priority: 2 },

  // Open redirect and SSRF
  { fromIssueId: 'OPEN_REDIRECT',   toIssueId: 'SSRF',              type: 'RELATED_TO', reason: 'Both stem from unvalidated user-controlled URLs',                     priority: 2 },

  // Empty catch and unhandled promise
  { fromIssueId: 'EMPTY_CATCH',     toIssueId: 'UNHANDLED_PROMISE', type: 'RELATED_TO', reason: 'Both silently suppress errors; fix together for reliable error handling', priority: 2 },

  // Missing timeout and sync file I/O
  { fromIssueId: 'MISSING_TIMEOUT', toIssueId: 'SYNC_FILE_IN_SERVER', type: 'RELATED_TO', reason: 'Both block the event loop — address together for responsiveness',   priority: 2 },

  // No pagination and N+1
  { fromIssueId: 'NO_PAGINATION',   toIssueId: 'N_PLUS_ONE',        type: 'RELATED_TO', reason: 'Both cause unbounded DB work; fix pagination first to cap rows',      priority: 2 },

  // Nested loop and string concat
  { fromIssueId: 'NESTED_LOOP',     toIssueId: 'STRING_CONCAT_LOOP', type: 'RELATED_TO', reason: 'Both create O(n²) operations; often co-occur in data transform code', priority: 3 },

  // Magic number and poor naming
  { fromIssueId: 'MAGIC_NUMBER',    toIssueId: 'POOR_NAMING',       type: 'RELATED_TO', reason: 'Magic numbers often accompany poor naming — refactor both together',   priority: 3 },

  // Debug enabled and sensitive data logging
  { fromIssueId: 'DEBUG_ENABLED',   toIssueId: 'SENSITIVE_DATA_LOG', type: 'CAUSES',    reason: 'Debug mode often enables verbose logging that leaks sensitive data',   priority: 1 },
  { fromIssueId: 'SENSITIVE_DATA_LOG', toIssueId: 'DEBUG_ENABLED',   type: 'BLOCKED_BY', reason: 'Sensitive data logging risk is highest when debug is enabled',       priority: 1 },

  // Prototype pollution and NoSQL injection
  { fromIssueId: 'PROTOTYPE_POLLUTION', toIssueId: 'NOSQL_INJECTION', type: 'RELATED_TO', reason: 'Both arise from unsanitised object input',                          priority: 2 },

  // Process exit and unhandled promise
  { fromIssueId: 'PROCESS_EXIT',    toIssueId: 'UNHANDLED_PROMISE', type: 'RELATED_TO', reason: 'process.exit() often used to handle promise rejection — fix properly', priority: 2 },

  // Too many params and long function
  { fromIssueId: 'TOO_MANY_PARAMS', toIssueId: 'LONG_FUNCTION',     type: 'RELATED_TO', reason: 'Long functions often accumulate too many params; refactor both',      priority: 3 },
  { fromIssueId: 'LONG_FUNCTION',   toIssueId: 'DEEP_NESTING',      type: 'RELATED_TO', reason: 'Long functions tend to have deeply nested logic; split them',          priority: 3 },
];

export class IssueRelationshipService {
  findRelationships(issueId: string): IssueRelationship[] {
    return RELATIONSHIPS.filter(r => r.fromIssueId === issueId);
  }

  calculateOptimalFixOrder(issueIds: string[]): string[] {
    const idSet = new Set(issueIds);
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const id of issueIds) {
      inDegree.set(id, 0);
      adj.set(id, []);
    }

    for (const rel of RELATIONSHIPS) {
      // BLOCKS/DEPENDS_ON: from must come before to
      // CAUSED_BY: the cause (to) must be fixed before the effect (from)
      let before: string, after: string;
      if (rel.type === 'BLOCKS' || rel.type === 'DEPENDS_ON') {
        before = rel.fromIssueId; after = rel.toIssueId;
      } else if (rel.type === 'CAUSED_BY') {
        before = rel.toIssueId; after = rel.fromIssueId;
      } else {
        continue;
      }
      if (!idSet.has(before) || !idSet.has(after)) continue;
      adj.get(before)!.push(after);
      inDegree.set(after, (inDegree.get(after) ?? 0) + 1);
    }

    const queue = issueIds.filter(id => (inDegree.get(id) ?? 0) === 0);
    const result: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const neighbor of adj.get(node) ?? []) {
        const deg = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) queue.push(neighbor);
      }
    }

    // Cycle detected — fall back to original order
    if (result.length !== issueIds.length) return issueIds;

    return result;
  }

  explain(rel: IssueRelationship): string {
    const labels: Record<string, string> = {
      BLOCKS:      'blocks',
      BLOCKED_BY:  'is blocked by',
      DEPENDS_ON:  'depends on',
      RELATED_TO:  'is related to',
      CAUSES:      'causes',
      CAUSED_BY:   'is caused by',
    };
    return `${rel.fromIssueId} ${labels[rel.type] ?? rel.type} ${rel.toIssueId}: ${rel.reason}`;
  }

  generateReport(issueIds: string[]): string {
    const order = this.calculateOptimalFixOrder(issueIds);
    const lines: string[] = [
      '## Issue Relationships — Optimal Fix Order',
      '',
      '### Recommended sequence',
      '',
    ];

    order.forEach((id, i) => {
      lines.push(`${i + 1}. **${id}**`);
      const rels = this.findRelationships(id).filter(r => issueIds.includes(r.toIssueId));
      for (const rel of rels) {
        lines.push(`   - ${this.explain(rel)}`);
      }
    });

    lines.push('');
    lines.push(`_${issueIds.length} issue(s) analysed._`);
    return lines.join('\n');
  }
}
