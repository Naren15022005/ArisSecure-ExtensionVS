import { ExplanationService } from './ExplanationService';
import type { ExpertIssue, ExpertPattern } from '../types/expert-issues';

const SCALABILITY_PATTERNS: ExpertPattern[] = [
  {
    id: 'SEQUENTIAL_ASYNC',
    domain: 'Scalability',
    severity: 'high',
    message: 'await inside a loop runs operations sequentially — use Promise.all for parallelism',
    pattern: /\bfor\s*(?:Of|In)?\s*(?:await\s*)?\([^)]*\)\s*\{[^}]*\bawait\b|\bwhile\s*\([^)]*\)\s*\{[^}]*\bawait\b/g,
  },
  {
    id: 'N_PLUS_ONE',
    domain: 'Scalability',
    severity: 'high',
    message: 'Database query inside a loop causes N+1 queries — batch with a single query',
    pattern: /\bfor\s*(?:Of|In)?\s*(?:await\s*)?\([^)]*\)\s*\{[^}]*\b(?:db\.|query\s*\(|findOne|findAll|find\s*\()/g,
  },
  {
    id: 'NO_PAGINATION',
    domain: 'Scalability',
    severity: 'medium',
    message: 'Query returns all rows without LIMIT — add pagination to prevent OOM on large tables',
    pattern: /['"`]SELECT\s+\*\s+FROM\s+\w+(?:\s+WHERE[^'"`]*)?['"`](?![^'"`,;]*\bLIMIT\b)/gi,
  },
  {
    id: 'NESTED_LOOP',
    domain: 'Scalability',
    severity: 'medium',
    message: 'Nested loops create O(n²) complexity — use a Map for O(1) lookups instead',
    // [^{]* matches up to opening brace; [^}]*? lazily matches content until inner .forEach(
    pattern: /\.forEach\([^{]*\{[^}]*?\.forEach\(/g,
  },
  {
    id: 'STRING_CONCAT_LOOP',
    domain: 'Scalability',
    severity: 'medium',
    message: 'String concatenation in a loop is O(n²) — accumulate parts in an array and join once',
    pattern: /\bfor\b[^{]*\{[^}]*\+=\s*['"`][^'"`]*['"`]|\bfor\b[^{]*\{[^}]*\+=\s*\w+/g,
  },
  {
    id: 'UNBOUNDED_CACHE',
    domain: 'Scalability',
    severity: 'medium',
    message: 'Unbounded Map/Set used as cache — use an LRU cache with a size limit to prevent memory leaks',
    pattern: /\bnew\s+Map\s*\(\s*\)\s*;|new\s+Set\s*\(\s*\)\s*;/g,
  },
];

export class ScalabilityExpertService {
  scan(code: string): ExpertIssue[] {
    const results: ExpertIssue[] = [];

    for (const { id, domain, severity, message, pattern } of SCALABILITY_PATTERNS) {
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
