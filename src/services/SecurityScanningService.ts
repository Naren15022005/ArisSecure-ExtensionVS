import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import axios from 'axios';
import { ExplanationService, ExplanationData } from './ExplanationService';

const execAsync = promisify(exec);

export interface Vulnerability {
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  explanation?: ExplanationData;
}

interface VulnPattern {
  id: string;
  severity: Vulnerability['severity'];
  message: string;
  pattern: RegExp;
}

const VULN_PATTERNS: VulnPattern[] = [
  {
    id: 'SQL_INJECTION',
    severity: 'critical',
    message: 'SQL query built with string concatenation — use parameterized queries',
    // Matches: "SELECT ... FROM ..." + someVar
    pattern: /['"`][^'"`\r\n]*\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|WHERE|FROM|UNION)\b[^'"`\r\n]*['"`]\s*\+/gi,
  },
  {
    id: 'EVAL_USAGE',
    severity: 'critical',
    message: 'eval() executes dynamic code — never use with untrusted input',
    pattern: /\beval\s*\(/g,
  },
  {
    id: 'XSS_INNER_HTML',
    severity: 'high',
    message: 'innerHTML/outerHTML assignment can allow XSS when value contains user data',
    // Matches .innerHTML = or .innerHTML += but not .innerHTML === (comparison)
    pattern: /\.innerHTML\s*\+?=(?!=)/g,
  },
  {
    id: 'WEAK_CRYPTO',
    severity: 'medium',
    message: 'MD5 and SHA-1 are cryptographically broken — use SHA-256 or better',
    pattern: /createHash\s*\(\s*['"](?:md5|sha1|sha-1)['"]\s*\)|\bmd5\s*\(/gi,
  },
  {
    id: 'COMMAND_INJECTION',
    severity: 'critical',
    message: 'Shell execution with interpolated template literal — validate all inputs to prevent command injection',
    // Matches: exec(`cmd ${var}`) / execSync(`cmd ${var}`) / spawn(`cmd ${var}`)
    pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/g,
  },
  {
    id: 'INSECURE_RANDOM',
    severity: 'medium',
    message: 'Math.random() is not cryptographically secure — use crypto.randomBytes() for security tokens',
    pattern: /\bMath\.random\s*\(\s*\)/g,
  },
  {
    id: 'PATH_TRAVERSAL',
    severity: 'high',
    message: 'File path constructed from request data — sanitize to prevent path traversal attacks',
    pattern: /(?:readFile|writeFile|createReadStream|readFileSync)\s*\([^)]*(?:req\.|params\.|query\.|body\.)/gi,
  },
  {
    id: 'JWT_INSECURE',
    severity: 'critical',
    message: 'jwt.decode() skips signature verification — use jwt.verify() instead',
    pattern: /\bjwt\.decode\s*\(/g,
  },
  {
    id: 'NOSQL_INJECTION',
    severity: 'high',
    message: 'NoSQL query field taken from req.body without type validation — operator injection risk',
    pattern: /(?:findOne|find|updateOne|deleteOne)\s*\(\s*\{[^}]*(?:req\.body|req\.params|req\.query)/gi,
  },
  {
    id: 'DEBUG_ENABLED',
    severity: 'medium',
    message: "Debug mode hardcoded to true — gate on NODE_ENV or a DEBUG env variable",
    pattern: /(?:debug|DEBUG)\s*[:=]\s*true(?!\s*&&|\s*\|\|)/g,
  },
  {
    id: 'PROTOTYPE_POLLUTION',
    severity: 'high',
    message: 'Object.assign() with req data may allow __proto__ injection',
    pattern: /Object\.assign\s*\([^,]+,\s*req\./g,
  },
  {
    id: 'SSRF',
    severity: 'critical',
    message: 'Server-side request made with a user-controlled URL — validate against an allowlist',
    pattern: /\bfetch\s*\(\s*req\.|axios\.(?:get|post|put|delete)\s*\(\s*req\./g,
  },
  {
    id: 'CORS_ALL_ORIGINS',
    severity: 'high',
    message: "CORS configured with wildcard origin '*' — specify an explicit allowlist",
    pattern: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/g,
  },
  {
    id: 'COOKIE_INSECURE',
    severity: 'high',
    message: 'Cookie set without httpOnly flag — XSS can steal the session token',
    pattern: /res\.cookie\s*\(\s*['"][^'"]+['"]\s*,\s*[^,)]+\s*\)(?!\s*;?\s*\/\/)/g,
  },
  {
    id: 'OPEN_REDIRECT',
    severity: 'medium',
    message: 'Redirect target taken from user input — validate to prevent phishing redirects',
    pattern: /res\.redirect\s*\(\s*req\./g,
  },
  {
    id: 'SENSITIVE_DATA_LOG',
    severity: 'high',
    message: 'Password/token being logged — remove credential from log statement',
    pattern: /console\.\w+\s*\([^)]*(?:password|passwd|secret|token|apiKey|api_key)[^)]*\)/gi,
  },
  {
    id: 'DANGEROUS_HTML',
    severity: 'high',
    message: 'dangerouslySetInnerHTML without sanitization — use DOMPurify.sanitize()',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!.*DOMPurify)/g,
  },
];

export class SecurityScanningService {
  async scan(code: string): Promise<Vulnerability[]> {
    const token = vscode.workspace
      .getConfiguration('arisCode')
      .get<string>('semgrepApiToken') ?? '';

    if (token) {
      try {
        return await this.scanApi(code, token);
      } catch {
        // fall through to CLI
      }
    }

    try {
      return await this.scanCli(code);
    } catch {
      // semgrep not installed — use built-in pattern detection
      return this.scanPatterns(code);
    }
  }

  private scanPatterns(code: string): Vulnerability[] {
    const results: Vulnerability[] = [];

    for (const { id, severity, message, pattern } of VULN_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) {
        const line = code.substring(0, match.index).split('\n').length;
        if (!results.find(r => r.ruleId === id && r.line === line)) {
          results.push({
            ruleId: id,
            message,
            severity,
            line,
            explanation: ExplanationService.get(id),
          });
        }
      }
    }

    return results;
  }

  private async scanApi(code: string, token: string): Promise<Vulnerability[]> {
    const response = await axios.post(
      'https://api.semgrep.dev/api/validate',
      { code },
      { timeout: 30_000, headers: { Authorization: `Token ${token}` } }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.data.results ?? []).map((r: any) => ({
      ruleId: r.rule_id ?? 'unknown',
      message: r.message ?? 'Vulnerability detected',
      severity: this.normalizeSeverity(r.severity),
      line: r.line ?? 0,
      explanation: ExplanationService.get(r.rule_id ?? ''),
    }));
  }

  private async scanCli(code: string): Promise<Vulnerability[]> {
    const tmp = path.join(os.tmpdir(), `aris_${Date.now()}.tmp`);
    fs.writeFileSync(tmp, code, 'utf-8');
    try {
      const { stdout } = await execAsync(`semgrep --json --config auto ${tmp}`, { timeout: 30_000 });
      const parsed = JSON.parse(stdout);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (parsed.results ?? []).map((r: any) => ({
        ruleId: r.check_id ?? 'unknown',
        message: r.extra?.message ?? 'Vulnerability detected',
        severity: this.normalizeSeverity(r.extra?.severity),
        line: r.start?.line ?? 0,
        explanation: ExplanationService.get(r.check_id ?? ''),
      }));
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  private normalizeSeverity(raw?: string): Vulnerability['severity'] {
    const map: Record<string, Vulnerability['severity']> = {
      error: 'critical', warning: 'high', info: 'medium',
      critical: 'critical', high: 'high', medium: 'medium', low: 'low',
    };
    return map[raw?.toLowerCase() ?? ''] ?? 'medium';
  }
}
