import { ExplanationService } from './ExplanationService';
import type { ExpertIssue, ExpertPattern } from '../types/expert-issues';

const QUALITY_PATTERNS: ExpertPattern[] = [
  {
    id: 'EMPTY_CATCH',
    domain: 'Quality',
    severity: 'high',
    message: 'Empty catch block silently swallows errors — log or rethrow',
    pattern: /catch\s*\([^)]*\)\s*\{\s*(?:\/\/[^\n]*)?\s*\}/g,
  },
  {
    id: 'CONSOLE_LOG',
    domain: 'Quality',
    severity: 'low',
    message: 'console.log in production code — replace with a structured logger',
    pattern: /\bconsole\s*\.\s*(?:log|debug|info)\s*\(/g,
  },
  {
    id: 'TODO_FIXME',
    domain: 'Quality',
    severity: 'low',
    message: 'TODO/FIXME/HACK comment marks incomplete or workaround code',
    pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX)\b/gi,
  },
  {
    id: 'MAGIC_NUMBER',
    domain: 'Quality',
    severity: 'low',
    message: 'Magic number — extract to a named constant to reveal intent',
    // Avoid matching 0, 1, -1 (common innocuous values), port numbers, and index access
    pattern: /(?<![.\w])(?<!\.)\b(?!(?:0|1|2|-1)\b)\d{2,}\b(?!\s*[,\]\)]?\s*(?:ms|px|vh|vw|em|rem|%|s\b))/g,
  },
  {
    id: 'TOO_MANY_PARAMS',
    domain: 'Quality',
    severity: 'medium',
    message: 'Function with 5+ parameters — use a parameter object instead',
    pattern: /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()\s*[^)]*,\s*[^)]*,\s*[^)]*,\s*[^)]*,\s*[^)]*[^)]*\)/g,
  },
  {
    id: 'DEEP_NESTING',
    domain: 'Quality',
    severity: 'medium',
    message: 'Deeply nested code (4+ levels) — use early returns to flatten',
    pattern: /^(?:\t| {2}){4,}(?:if|for|while|switch)\s*\(/gm,
  },
  {
    id: 'POOR_NAMING',
    domain: 'Quality',
    severity: 'low',
    message: 'Single-character variable name — use an intention-revealing name',
    pattern: /\b(?:let|const|var)\s+([a-z])\s*[=:]/g,
  },
  {
    id: 'LONG_FUNCTION',
    domain: 'Quality',
    severity: 'medium',
    message: 'Function body is very long — consider splitting into smaller functions',
    // Detects functions with 30+ lines of content between opening and closing brace
    pattern: /(?:function\s+\w+|=>\s*)\{(?:[^{}]|\{[^{}]*\}){500,}/g,
  },
];

export class CodeQualityExpertService {
  scan(code: string): ExpertIssue[] {
    const results: ExpertIssue[] = [];

    for (const { id, domain, severity, message, pattern } of QUALITY_PATTERNS) {
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
