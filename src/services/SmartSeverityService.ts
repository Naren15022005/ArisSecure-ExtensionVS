import type { Severity } from '../types/expert-issues';

export interface SeverityContext {
  inLoop?: boolean;
  loopBounded?: boolean;
  loopIterations?: number;
  inProduction?: boolean;
  inTest?: boolean;
  hasFallback?: boolean;
  hasRetry?: boolean;
}

const SECURITY_IDS = new Set([
  'SQL_INJECTION', 'XSS', 'EVAL_USE', 'COMMAND_INJECTION', 'PATH_TRAVERSAL',
  'JWT_INSECURE', 'NOSQL_INJECTION', 'SSRF', 'PROTOTYPE_POLLUTION',
  'CORS_ALL_ORIGINS', 'COOKIE_INSECURE', 'OPEN_REDIRECT', 'DANGEROUS_HTML',
]);

export class SmartSeverityService {
  adjust(issueId: string, ctx: SeverityContext): Severity {
    const base = this._baseSeverity(issueId);

    if (SECURITY_IDS.has(issueId) && base === 'critical') return 'critical';

    if (ctx.inTest) return this._downgrade(base);

    if (ctx.inLoop && !ctx.loopBounded) {
      if (issueId === 'SEQUENTIAL_ASYNC') {
        return (ctx.loopIterations ?? 0) > 1000 ? 'critical' : 'high';
      }
      if (issueId === 'N_PLUS_ONE') return 'critical';
    }

    if (ctx.hasFallback || ctx.hasRetry) return this._downgrade(base);

    return base;
  }

  analyzeContext(code: string, issueLine: number): SeverityContext {
    const lines = code.split('\n');
    const lineText = lines[Math.max(0, issueLine - 1)] ?? '';
    const window = lines.slice(Math.max(0, issueLine - 5), issueLine + 5).join('\n');

    const inLoop = /\bfor\b|\bwhile\b|\bforEach\b/.test(window);
    const loopBounded = /\bLIMIT\b|\bslice\b|\bsplice\b|\blength\s*</.test(window);
    const inTest = /\b(?:it|test|describe|expect|beforeEach|afterEach)\s*\(/.test(window) ||
                   /\.test\.|\.spec\./.test(code.substring(0, 200));
    const hasFallback = /catch\s*\(/.test(window) || /\?\?/.test(lineText);
    const hasRetry = /retry|retryable|backoff/i.test(window);
    const inProduction = !/\bdev\b|\btest\b|\bstaging\b/i.test(
      lines.slice(0, 3).join('\n')
    );

    return { inLoop, loopBounded, inProduction, inTest, hasFallback, hasRetry };
  }

  explain(issueId: string, original: Severity, adjusted: Severity, ctx: SeverityContext): string {
    if (original === adjusted) return `[${issueId}] Severity ${original} — no context adjustment applied.`;

    const reasons: string[] = [];
    if (ctx.inTest) reasons.push('issue is in test code');
    if (ctx.inLoop && !ctx.loopBounded) reasons.push('runs in an unbounded loop');
    if ((ctx.loopIterations ?? 0) > 1000) reasons.push('loop may exceed 1 000 iterations');
    if (ctx.hasFallback) reasons.push('a fallback is present');
    if (ctx.hasRetry) reasons.push('retry logic detected');

    const RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const dir = (RANK[adjusted] ?? 0) > (RANK[original] ?? 0) ? 'Upgraded' : 'Downgraded';
    return `${dir} from ${original} to ${adjusted} because: ${reasons.join(', ')}.`;
  }

  private _baseSeverity(issueId: string): Severity {
    const HIGH = new Set([
      'SEQUENTIAL_ASYNC', 'N_PLUS_ONE', 'SQL_INJECTION', 'XSS', 'EVAL_USE',
      'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'UNHANDLED_PROMISE', 'SYNC_FILE_IN_SERVER',
      'NO_INPUT_VALIDATION', 'JWT_INSECURE', 'NOSQL_INJECTION', 'SSRF',
      'PROTOTYPE_POLLUTION', 'DANGEROUS_HTML',
    ]);
    const CRITICAL = new Set([
      'SQL_INJECTION', 'XSS', 'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'EVAL_USE',
    ]);
    if (CRITICAL.has(issueId)) return 'critical';
    if (HIGH.has(issueId)) return 'high';
    return 'medium';
  }

  private _downgrade(s: Severity): Severity {
    if (s === 'critical') return 'high';
    if (s === 'high') return 'medium';
    if (s === 'medium') return 'low';
    return 'low';
  }
}
