import { ExplanationService } from './ExplanationService';
import type { ExpertIssue, ExpertPattern } from '../types/expert-issues';

const DEVOPS_PATTERNS: ExpertPattern[] = [
  {
    id: 'HARDCODED_IP',
    domain: 'DevOps',
    severity: 'medium',
    message: 'Hardcoded IP address — use an environment variable instead',
    // Match quoted strings that contain an IPv4 address
    pattern: /['"`][^'"`\r\n]*(?:\d{1,3}\.){3}\d{1,3}[^'"`\r\n]*['"`]/g,
  },
  {
    id: 'UNHANDLED_PROMISE',
    domain: 'DevOps',
    severity: 'high',
    message: '.then() without .catch() — unhandled rejection will crash Node.js',
    // Match a line that has .then( but does NOT have .catch anywhere on that line
    pattern: /^(?!.*\.catch\b).*\.then\s*\(/gm,
  },
  {
    id: 'PROCESS_EXIT',
    domain: 'DevOps',
    severity: 'medium',
    message: 'process.exit() inside application logic — use graceful shutdown instead',
    pattern: /\bprocess\.exit\s*\(/g,
  },
  {
    id: 'SYNC_FILE_IN_SERVER',
    domain: 'DevOps',
    severity: 'high',
    message: 'Synchronous file I/O blocks the event loop — use fs.promises instead',
    pattern: /\bfs\.(?:readFileSync|writeFileSync|appendFileSync|existsSync|mkdirSync|readdirSync)\s*\(/g,
  },
  {
    id: 'MISSING_TIMEOUT',
    domain: 'DevOps',
    severity: 'medium',
    message: 'HTTP request without timeout — a slow response will stall indefinitely',
    // Matches: await fetch(url) where the argument does not contain 'timeout' or 'signal'
    pattern: /\bawait\s+fetch\s*\(\s*[^,)]+\s*\)(?!\s*\/\*[^*]*timeout)/g,
  },
  {
    id: 'NO_INPUT_VALIDATION',
    domain: 'DevOps',
    severity: 'high',
    message: 'Request body used without schema validation — validate with Zod or Joi',
    // Match any access of req.body / req.params / req.query
    pattern: /\breq\.(?:body|params|query)\b/g,
  },
];

export class DevOpsExpertService {
  scan(code: string): ExpertIssue[] {
    const results: ExpertIssue[] = [];

    for (const { id, domain, severity, message, pattern } of DEVOPS_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) {
        const line = code.substring(0, match.index).split('\n').length;
        if (!results.find(r => r.id === id && r.line === line)) {
          results.push({ id, domain, severity, title: id, message, line, explanation: ExplanationService.get(id) });
        }
      }
    }

    return results;
  }
}
