import * as vscode from 'vscode';
import { CodeGenerationService } from './services/CodeGenerationService';
import { SecurityScanningService, Vulnerability } from './services/SecurityScanningService';
import { SecretDetectionService, Secret } from './services/SecretDetectionService';
import { CodeQualityExpertService } from './services/CodeQualityExpertService';
import { DevOpsExpertService } from './services/DevOpsExpertService';
import { ScalabilityExpertService } from './services/ScalabilityExpertService';
import { AutoFixService } from './services/AutoFixService';
import { SmartSeverityService } from './services/SmartSeverityService';
import { IssueRelationshipService } from './services/IssueRelationshipService';
import { LogicBasedRemediationService } from './services/LogicBasedRemediationService';
import { validatePrompt } from './utils/validation';
import { IssueTreeProvider, IssueData } from './views/IssueTreeProvider';
import type { ExpertIssue } from './types/expert-issues';

let outputChannel: vscode.OutputChannel;
const diagnostics = vscode.languages.createDiagnosticCollection('aris-code');

const codeGen = new CodeGenerationService();
const security = new SecurityScanningService();
const secrets = new SecretDetectionService();
const quality = new CodeQualityExpertService();
const devops = new DevOpsExpertService();
const scalability = new ScalabilityExpertService();
const autoFix = new AutoFixService();
const smartSev = new SmartSeverityService();
const relationships = new IssueRelationshipService();
const remediation = new LogicBasedRemediationService();
let treeProvider: IssueTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Aris Code');
  treeProvider = new IssueTreeProvider();

  vscode.window.registerTreeDataProvider('arisCode-issues', treeProvider);

  context.subscriptions.push(
    diagnostics,
    vscode.commands.registerCommand('arisCode.generate', generateCommand),
    vscode.commands.registerCommand('arisCode.scanFile', scanFileCommand),
    vscode.commands.registerCommand('arisCode.quickScan', quickScanCommand),
    vscode.commands.registerCommand('arisCode.goToIssue', goToIssueCommand),
    vscode.commands.registerCommand('arisCode.applyFix', applyFixCommand),
    vscode.commands.registerCommand('arisCode.copyAllIssues', copyAllIssuesCommand),
    vscode.commands.registerCommand('arisCode.showRelationships', showRelationshipsCommand),
    vscode.commands.registerCommand('arisCode.suggestFix', suggestFixCommand),
  );

  outputChannel.appendLine('Aris Code v0.3.0 activated.');
  outputChannel.appendLine('Quick Scan : Ctrl+Shift+Alt+Q  |  Full Scan: Ctrl+Shift+Alt+S  |  Generate: Ctrl+Shift+Alt+G');
  outputChannel.appendLine('Sidebar    : click the shield icon in the Activity Bar');
}

export function deactivate(): void {
  outputChannel?.dispose();
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function generateCommand(): Promise<void> {
  const prompt = await vscode.window.showInputBox({
    title: 'Aris Code — Generate Secure Code',
    prompt: 'Describe the code you want to generate',
    placeHolder: 'e.g. Python function that validates and sanitizes email input',
    validateInput: input => {
      try {
        validatePrompt(input ?? '');
        return null;
      } catch (err) {
        return (err as Error).message;
      }
    },
  });

  if (!prompt) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Aris Code', cancellable: false },
    async progress => {
      progress.report({ message: 'Generating code…' });

      let code: string;
      try {
        code = await codeGen.generate(prompt);
      } catch (err) {
        vscode.window.showErrorMessage(`Aris Code: ${(err as Error).message}`);
        return;
      }

      progress.report({ message: 'Scanning for vulnerabilities…' });

      const [vulns, detectedSecrets, qualityIssues, devopsIssues, scalabilityIssues] =
        await Promise.all([
          security.scan(code),
          secrets.detect(code),
          Promise.resolve(quality.scan(code)),
          Promise.resolve(devops.scan(code)),
          Promise.resolve(scalability.scan(code)),
        ]);

      const issueData = buildIssueData(code, vulns, detectedSecrets, qualityIssues, devopsIssues, scalabilityIssues);
      writeResultsToOutput(code, issueData);
      treeProvider.setIssues(issueData);
      await insertOrCopy(code);
    }
  );
}

async function scanFileCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Aris Code: Open a file to scan.');
    return;
  }

  const code = editor.document.getText();

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Aris Code: Scanning…', cancellable: false },
    async () => {
      const [vulns, detectedSecrets, qualityIssues, devopsIssues, scalabilityIssues] =
        await Promise.all([
          security.scan(code),
          secrets.detect(code),
          Promise.resolve(quality.scan(code)),
          Promise.resolve(devops.scan(code)),
          Promise.resolve(scalability.scan(code)),
        ]);

      const issueData = buildIssueData(code, vulns, detectedSecrets, qualityIssues, devopsIssues, scalabilityIssues);
      applyDiagnostics(editor.document, vulns, detectedSecrets);
      treeProvider.setIssues(issueData);
      showScanSummary(issueData);
      writeScanResultsToOutput(issueData);
    }
  );
}

async function quickScanCommand(): Promise<void> {
  await scanFileCommand();
  vscode.commands.executeCommand('arisCode-issues.focus');
}

function goToIssueCommand(line: number): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const lineIdx = Math.max(0, line - 1);
  const pos = new vscode.Position(lineIdx, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
}

async function applyFixCommand(issue: IssueData): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Aris Code: Open the affected file first.');
    return;
  }

  goToIssueCommand(issue.line);

  const fix = autoFix.generateFix(issue);
  if (fix) {
    const label = fix.requiresConfirmation
      ? `Apply fix: ${fix.description}?`
      : fix.description;

    const actions = fix.requiresConfirmation
      ? ['Apply Fix', 'View Documentation', 'Dismiss']
      : ['Apply Fix', 'Dismiss'];

    const choice = await vscode.window.showInformationMessage(label, ...actions);

    if (choice === 'Apply Fix') {
      const applied = await autoFix.applyFix(fix, editor);
      if (applied) {
        vscode.window.showInformationMessage(`Aris Code: Fix applied — ${fix.description}`);
        void scanFileCommand();
        return;
      }
    }

    if (choice === 'View Documentation' && issue.explanation?.example.docsUrl) {
      vscode.env.openExternal(vscode.Uri.parse(issue.explanation.example.docsUrl));
    }
    return;
  }

  const exp = issue.explanation;
  if (!exp) {
    vscode.window.showInformationMessage(`Aris Code: Review line ${issue.line} manually.`);
    return;
  }

  const secureSnippet = exp.example.secure.split('\n')[1]?.trim() ?? exp.example.secure.substring(0, 80);
  const actions = exp.example.docsUrl ? ['View Documentation', 'Dismiss'] : ['Dismiss'];

  const choice = await vscode.window.showInformationMessage(
    `Fix for [L${issue.line}] ${issue.title}: ${secureSnippet}`,
    ...actions
  );

  if (choice === 'View Documentation' && exp.example.docsUrl) {
    vscode.env.openExternal(vscode.Uri.parse(exp.example.docsUrl));
  }
}

async function copyAllIssuesCommand(): Promise<void> {
  const issues = treeProvider.getAllIssues();
  if (issues.length === 0) {
    vscode.window.showInformationMessage('Aris Code: No issues to copy — run a scan first.');
    return;
  }
  const report = buildReportText(issues);
  await vscode.env.clipboard.writeText(report);
  vscode.window.showInformationMessage(`Aris Code: ${issues.length} issue(s) copied to clipboard.`);
}

function suggestFixCommand(issue: IssueData): void {
  const suggestion = remediation.suggestFix(issue.title);
  if (!suggestion) {
    vscode.window.showInformationMessage(`Aris Code: No remediation guide for ${issue.title}.`);
    return;
  }

  const lines: string[] = [
    `# Remediation: ${suggestion.issueId}`,
    '',
    `**Problem:** ${suggestion.problem}`,
    '',
    `**Explanation:** ${suggestion.explanation}`,
    '',
    `**Severity:** ${suggestion.severity}  |  **Confidence:** ${suggestion.confidence}  |  **Est. fix time:** ${suggestion.estimatedFixTimeMinutes} min`,
    '',
    '## Vulnerable code',
    '```',
    suggestion.currentCodeBad ?? 'N/A',
    '```',
    '',
    '## Secure alternative',
    '```',
    suggestion.suggestedCodeGood ?? 'N/A',
    '```',
    '',
    '## Steps',
    ...suggestion.steps.map((s, i) => `${i + 1}. ${s}`),
  ];

  if (suggestion.performanceGainMs != null) {
    lines.push('', `**Performance gain:** ~${suggestion.performanceGainMs}ms${suggestion.performanceGainPercent != null ? ` (${suggestion.performanceGainPercent}%)` : ''}`);
  }
  if (suggestion.envVarNeeded) {
    lines.push(`**Environment variable needed:** \`${suggestion.envVarNeeded}\``);
  }
  if (suggestion.relatedIssues?.length) {
    lines.push(`**Related issues:** ${suggestion.relatedIssues.join(', ')}`);
  }

  outputChannel.clear();
  outputChannel.appendLine(lines.join('\n'));
  outputChannel.show(true);
  vscode.window.showInformationMessage(`Aris Code: Remediation guide for ${suggestion.issueId} shown in output.`);
}

function showRelationshipsCommand(): void {
  const issues = treeProvider.getAllIssues();
  if (issues.length === 0) {
    vscode.window.showInformationMessage('Aris Code: Run a scan first to see issue relationships.');
    return;
  }

  const issueIds = [...new Set(issues.map(i => i.title))];
  const report = relationships.generateReport(issueIds);
  outputChannel.clear();
  outputChannel.appendLine(report);
  outputChannel.show(true);
}

// ── Build issue data ──────────────────────────────────────────────────────────

function buildIssueData(
  code: string,
  vulns: Vulnerability[],
  detectedSecrets: Secret[],
  qualityIssues: ExpertIssue[],
  devopsIssues: ExpertIssue[],
  scalabilityIssues: ExpertIssue[],
): IssueData[] {
  const issues: IssueData[] = [];

  for (const v of vulns) {
    const ctx = smartSev.analyzeContext(code, v.line);
    const adjustedSeverity = smartSev.adjust(v.ruleId, ctx);
    issues.push({
      type: 'vulnerability',
      domain: 'Security',
      title: v.ruleId,
      message: v.message,
      line: v.line,
      severity: adjustedSeverity,
      explanation: v.explanation,
    });
  }

  for (const s of detectedSecrets) {
    issues.push({
      type: 'secret',
      domain: 'Security',
      title: s.type,
      message: 'Hardcoded secret — move to environment variable',
      line: s.line,
      severity: 'critical',
      explanation: s.explanation,
    });
  }

  for (const q of qualityIssues) {
    issues.push({
      type: 'quality',
      domain: 'Quality',
      title: q.title,
      message: q.message,
      line: q.line,
      severity: q.severity,
      explanation: q.explanation,
    });
  }

  for (const d of devopsIssues) {
    issues.push({
      type: 'devops',
      domain: 'DevOps',
      title: d.title,
      message: d.message,
      line: d.line,
      severity: d.severity,
      explanation: d.explanation,
    });
  }

  for (const sc of scalabilityIssues) {
    issues.push({
      type: 'scalability',
      domain: 'Scalability',
      title: sc.title,
      message: sc.message,
      line: sc.line,
      severity: sc.severity,
      explanation: sc.explanation,
    });
  }

  return issues;
}

// ── Report builder ────────────────────────────────────────────────────────────

function buildReportText(issues: IssueData[]): string {
  const lines: string[] = [
    '='.repeat(60),
    'Aris Code — Security & Quality Report',
    `Total: ${issues.length} issue(s)`,
    '='.repeat(60),
    '',
  ];

  const byDomain = new Map<string, IssueData[]>();
  for (const issue of issues) {
    const arr = byDomain.get(issue.domain) ?? [];
    arr.push(issue);
    byDomain.set(issue.domain, arr);
  }

  for (const [domain, domainIssues] of byDomain) {
    lines.push(`--- ${domain} (${domainIssues.length}) ---`);
    for (const issue of domainIssues) {
      lines.push(`[${issue.severity.toUpperCase()}] L${issue.line}: ${issue.title}`);
      lines.push(`  ${issue.message}`);
      if (issue.explanation) {
        const exp = issue.explanation;
        lines.push(`  What: ${exp.what}`);
        lines.push(`  Why:  ${exp.why}`);
        if (exp.remediation.length > 0) {
          lines.push(`  Fix:  ${exp.remediation[0].title}`);
        }
        lines.push(`  Ref:  ${exp.standard.owaspUrl}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Output & diagnostics ──────────────────────────────────────────────────────

function writeResultsToOutput(code: string, issues: IssueData[]): void {
  outputChannel.clear();
  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine('Aris Code — Generated Code');
  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine(code);
  writeScanResultsToOutput(issues);
}

function writeScanResultsToOutput(issues: IssueData[]): void {
  outputChannel.appendLine('');
  outputChannel.appendLine('='.repeat(60));
  outputChannel.appendLine('Aris Code — Scan Results');
  outputChannel.appendLine('='.repeat(60));

  if (issues.length === 0) {
    outputChannel.appendLine('No issues detected.');
  } else {
    for (const issue of issues) {
      outputChannel.appendLine(
        `[${issue.domain}][${issue.severity.toUpperCase()}] L${issue.line}: ${issue.message} (${issue.title})`
      );
      if (issue.explanation) {
        outputChannel.appendLine(`  Fix: ${issue.explanation.remediation[0]?.title ?? ''}`);
        outputChannel.appendLine(`  Ref: ${issue.explanation.example.docsUrl ?? issue.explanation.standard.owaspUrl}`);
      }
    }
    outputChannel.appendLine('');
    outputChannel.appendLine(`Total: ${issues.length} issue(s). Expand items in the Aris sidebar for full details.`);
  }

  outputChannel.show(true);
}

async function insertOrCopy(code: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await editor.edit(edit => edit.insert(editor.selection.active, code));
  } else {
    await vscode.env.clipboard.writeText(code);
    vscode.window.showInformationMessage('Aris Code: Code copied to clipboard.');
  }
}

function applyDiagnostics(
  doc: vscode.TextDocument,
  vulns: Vulnerability[],
  detectedSecrets: Secret[]
): void {
  const items: vscode.Diagnostic[] = [];

  for (const v of vulns) {
    const lineIdx = Math.max(0, v.line - 1);
    const lineText = doc.lineAt(Math.min(lineIdx, doc.lineCount - 1));
    const range = new vscode.Range(lineIdx, 0, lineIdx, lineText.text.length);
    const sev = (v.severity === 'critical' || v.severity === 'high')
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;
    const d = new vscode.Diagnostic(range, `[Aris] ${v.message} (${v.ruleId})`, sev);
    d.source = 'Aris Code';
    items.push(d);
  }

  for (const s of detectedSecrets) {
    const lineIdx = Math.max(0, s.line - 1);
    const lineText = doc.lineAt(Math.min(lineIdx, doc.lineCount - 1));
    const range = new vscode.Range(lineIdx, 0, lineIdx, lineText.text.length);
    const d = new vscode.Diagnostic(
      range,
      `[Aris] ${s.type} detected — use an environment variable instead`,
      vscode.DiagnosticSeverity.Error
    );
    d.source = 'Aris Code';
    items.push(d);
  }

  diagnostics.set(doc.uri, items);
}

function showScanSummary(issues: IssueData[]): void {
  const total = issues.length;
  if (total === 0) {
    vscode.window.showInformationMessage('Aris Code: No issues detected.');
    return;
  }
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const message = criticalCount > 0
    ? `Aris Code: ${total} issue(s) — ${criticalCount} CRITICAL. Expand the sidebar for full details.`
    : `Aris Code: ${total} issue(s). Check the sidebar for explanations and fixes.`;
  vscode.window.showWarningMessage(message);
}
