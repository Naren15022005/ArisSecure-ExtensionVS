import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import axios from 'axios';

const execAsync = promisify(exec);

export interface Vulnerability {
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
}

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
      return [];
    }
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
