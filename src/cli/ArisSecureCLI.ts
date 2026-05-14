/**
 * Standalone CLI — scans a directory with all 4 expert services.
 * Usage: node dist/cli.js --path ./src [--format json|text|markdown] [--severity critical|high|medium|low] [--output report.json]
 */

// Stub vscode so services that import workspace.getConfiguration work without the IDE
(global as Record<string, unknown>).vscode = {
  workspace: {
    getConfiguration: () => ({ get: (_: string, fallback: unknown) => fallback }),
  },
};

import * as fs from 'fs';
import * as path from 'path';
import { SecurityScanningService } from '../services/SecurityScanningService';
import { SecretDetectionService } from '../services/SecretDetectionService';
import { CodeQualityExpertService } from '../services/CodeQualityExpertService';
import { DevOpsExpertService } from '../services/DevOpsExpertService';
import { ScalabilityExpertService } from '../services/ScalabilityExpertService';
import type { ExpertIssue } from '../types/expert-issues';

export interface ScanResult {
  file: string;
  issues: ExpertIssue[];
}

type OutputFormat = 'json' | 'text' | 'markdown';
type MinSeverity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_RANK: Record<MinSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export async function scan(opts: {
  rootPath: string;
  format?: OutputFormat;
  minSeverity?: MinSeverity;
  outputFile?: string;
}): Promise<ScanResult[]> {
  const { rootPath, minSeverity = 'low' } = opts;

  const security = new SecurityScanningService();
  const secrets = new SecretDetectionService();
  const quality = new CodeQualityExpertService();
  const devops = new DevOpsExpertService();
  const scalability = new ScalabilityExpertService();

  const files = walkFiles(rootPath, /\.(ts|tsx|js|jsx)$/);
  const results: ScanResult[] = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');

    const [vulns, detectedSecrets] = await Promise.all([
      security.scan(code),
      secrets.detect(code),
    ]);

    const raw: ExpertIssue[] = [
      ...vulns.map(v => ({ id: v.ruleId, domain: 'Security', severity: v.severity, title: v.ruleId, message: v.message, line: v.line, explanation: v.explanation } as ExpertIssue)),
      ...detectedSecrets.map(s => ({ id: s.type, domain: 'Security', severity: 'critical', title: s.type, message: 'Hardcoded secret', line: s.line, explanation: s.explanation } as ExpertIssue)),
      ...quality.scan(code),
      ...devops.scan(code),
      ...scalability.scan(code),
    ];

    const minRank = SEVERITY_RANK[minSeverity];
    const issues = raw.filter(i => (SEVERITY_RANK[i.severity as MinSeverity] ?? 0) >= minRank);

    if (issues.length > 0) results.push({ file, issues });
  }

  return results;
}

function walkFiles(dir: string, ext: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      out.push(...walkFiles(full, ext));
    } else if (entry.isFile() && ext.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function formatText(results: ScanResult[]): string {
  if (results.length === 0) return 'ArisSecure: No issues found.\n';
  const lines: string[] = [];
  for (const { file, issues } of results) {
    lines.push(`\n=== ${file} (${issues.length} issue(s)) ===`);
    for (const i of issues) {
      lines.push(`  [${i.severity.toUpperCase()}] L${i.line}: ${i.title} — ${i.message}`);
    }
  }
  const total = results.reduce((n, r) => n + r.issues.length, 0);
  lines.push(`\nTotal: ${total} issue(s) in ${results.length} file(s).`);
  return lines.join('\n');
}

function formatMarkdown(results: ScanResult[]): string {
  const total = results.reduce((n, r) => n + r.issues.length, 0);
  const lines = [`# ArisSecure Scan Report`, ``, `**${total} issue(s)** across **${results.length} file(s)**`, ``];
  for (const { file, issues } of results) {
    lines.push(`## \`${file}\``);
    for (const i of issues) {
      lines.push(`- **[${i.severity.toUpperCase()}] L${i.line}** \`${i.title}\` — ${i.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── CLI entry point ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const rootPath    = get('--path') ?? '.';
  const format      = (get('--format') ?? 'text') as OutputFormat;
  const minSeverity = (get('--severity') ?? 'low') as MinSeverity;
  const outputFile  = get('--output');

  const results = await scan({ rootPath, format, minSeverity });

  let output: string;
  if (format === 'json') {
    output = JSON.stringify(results, null, 2);
  } else if (format === 'markdown') {
    output = formatMarkdown(results);
  } else {
    output = formatText(results);
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf-8');
    console.log(`ArisSecure: Report written to ${outputFile}`);
  } else {
    console.log(output);
  }

  const hasCritical = results.some(r => r.issues.some(i => i.severity === 'critical'));
  process.exit(hasCritical ? 1 : 0);
}

main().catch(err => {
  console.error('ArisSecure CLI error:', err);
  process.exit(2);
});
