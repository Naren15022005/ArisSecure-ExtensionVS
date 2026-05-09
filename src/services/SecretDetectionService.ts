import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Secret {
  type: string;
  line: number;
}

const PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'AWS_ACCESS_KEY',  pattern: /AKIA[0-9A-Z]{16}/g },
  { type: 'OPENAI_API_KEY',  pattern: /sk-[A-Za-z0-9]{20,}/g },
  { type: 'GITHUB_TOKEN',    pattern: /gh[pousr]_[A-Za-z0-9]{36}/g },
  { type: 'PRIVATE_KEY',     pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { type: 'PASSWORD',        pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{4,})['"]/gi },
  { type: 'DB_URL',          pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^@\s]+:[^@\s]+@/gi },
  { type: 'GENERIC_SECRET',  pattern: /(?:secret|token|api[_-]?key)\s*[:=]\s*['"]([^'"]{8,})['"]/gi },
];

export class SecretDetectionService {
  async detect(code: string): Promise<Secret[]> {
    try {
      return await this.detectCli(code);
    } catch {
      return this.detectPatterns(code);
    }
  }

  private async detectCli(code: string): Promise<Secret[]> {
    const tmp = path.join(os.tmpdir(), `aris_sec_${Date.now()}.tmp`);
    fs.writeFileSync(tmp, code, 'utf-8');
    try {
      const { stdout } = await execAsync(
        `truffleHog filesystem ${tmp} --json --no-verification`,
        { timeout: 15_000 }
      );
      if (!stdout.trim()) return [];
      return stdout.split('\n').filter(Boolean).flatMap(line => {
        try {
          const p = JSON.parse(line);
          return [{ type: p.DetectorName ?? 'UNKNOWN', line: p.SourceMetadata?.Data?.Filesystem?.line ?? 0 }];
        } catch { return []; }
      });
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  private detectPatterns(code: string): Secret[] {
    const secrets: Secret[] = [];
    for (const { type, pattern } of PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) {
        const line = code.substring(0, match.index).split('\n').length;
        if (!secrets.find(s => s.line === line && s.type === type)) {
          secrets.push({ type, line });
        }
      }
    }
    return secrets;
  }
}
