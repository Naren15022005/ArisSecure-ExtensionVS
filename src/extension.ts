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
import { IssueTreeProvider, IssueData, IssueItem } from './views/IssueTreeProvider';
import type { ExpertIssue } from './types/expert-issues';

let outputChannel: vscode.OutputChannel;
const diagnostics = vscode.languages.createDiagnosticCollection('aris-code');

const codeGen      = new CodeGenerationService();
const security     = new SecurityScanningService();
const secrets      = new SecretDetectionService();
const quality      = new CodeQualityExpertService();
const devops       = new DevOpsExpertService();
const scalability  = new ScalabilityExpertService();
const autoFix      = new AutoFixService();
const smartSev     = new SmartSeverityService();
const relationships = new IssueRelationshipService();
const remediation  = new LogicBasedRemediationService();
let treeProvider: IssueTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Aris Code');
  treeProvider  = new IssueTreeProvider();

  const treeView = vscode.window.createTreeView('arisCode-issues', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  treeProvider.setTreeView(treeView);

  context.subscriptions.push(
    treeView,
    diagnostics,
    vscode.commands.registerCommand('arisCode.generate',           generateCommand),
    vscode.commands.registerCommand('arisCode.scanFile',           scanFileCommand),
    vscode.commands.registerCommand('arisCode.quickScan',          quickScanCommand),
    vscode.commands.registerCommand('arisCode.goToIssue',          goToIssueCommand),
    vscode.commands.registerCommand('arisCode.showIssueDetail',    showIssueDetailCommand),
    vscode.commands.registerCommand('arisCode.applyFix',           applyFixCommand),
    vscode.commands.registerCommand('arisCode.clearIssues',        clearIssuesCommand),
    vscode.commands.registerCommand('arisCode.copyAllIssues',      copyAllIssuesCommand),
    vscode.commands.registerCommand('arisCode.showRelationships',  showRelationshipsCommand),
    vscode.commands.registerCommand('arisCode.suggestFix',         suggestFixCommand),
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

function showIssueDetailCommand(issue: IssueData): void {
  // Navigate to line
  const editor = vscode.window.activeTextEditor;
  if (editor && issue.line > 0) {
    const pos = new vscode.Position(Math.max(0, issue.line - 1), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  outputChannel.clear();
  outputChannel.appendLine(buildIssueDetailOutput(issue));
  outputChannel.show(true);
}

async function applyFixCommand(itemOrIssue: IssueItem | IssueData): Promise<void> {
  const issue = itemOrIssue instanceof IssueItem ? itemOrIssue.issue : itemOrIssue;

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Aris Code: Open the affected file first.');
    return;
  }

  goToIssueCommand(issue.line);

  const fix = autoFix.generateFix(issue);
  if (fix) {
    const label = fix.requiresConfirmation ? `Apply fix: ${fix.description}?` : fix.description;
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

function clearIssuesCommand(): void {
  treeProvider.clearIssues();
  diagnostics.clear();
  outputChannel.clear();
  outputChannel.appendLine('Aris Code: Issues cleared. Run a new scan when ready.');
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

function suggestFixCommand(itemOrIssue: IssueItem | IssueData): void {
  const issue = itemOrIssue instanceof IssueItem ? itemOrIssue.issue : itemOrIssue;
  showIssueDetailCommand(issue);
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

// ── Issue detail output ───────────────────────────────────────────────────────

function buildIssueDetailOutput(issue: IssueData): string {
  const BAR  = '─'.repeat(66);
  const EDGE = '═'.repeat(66);
  const SEV  = issue.severity.toUpperCase();
  const lines: string[] = [];

  lines.push(EDGE);
  lines.push('  ARIS CODE — ISSUE DETAIL');
  lines.push(EDGE);
  lines.push('');
  lines.push(`  [${SEV}]  ${issue.title}  ·  Line ${issue.line}  ·  ${issue.domain}`);
  lines.push('');

  const exp = issue.explanation;
  const sug = remediation.suggestFix(issue.title);

  if (exp) {
    lines.push(`  PROBLEM`);
    lines.push(`  ${issue.message}`);
    lines.push('');
    lines.push(`  WHAT IS IT`);
    lines.push(indent(exp.what));
    lines.push('');
    lines.push(`  WHY IT MATTERS`);
    lines.push(indent(exp.why));
    lines.push('');

    if (exp.risks.length > 0) {
      lines.push(`  RISKS`);
      for (const risk of exp.risks) lines.push(`  • ${risk}`);
      lines.push('');
    }

    lines.push(BAR);
    lines.push('');
    lines.push(`  VULNERABLE CODE`);
    lines.push(indentBlock(exp.example.vulnerable));
    lines.push('');
    lines.push(`  SECURE ALTERNATIVE`);
    lines.push(indentBlock(exp.example.secure));
    lines.push('');

    if (exp.remediation.length > 0) {
      lines.push(BAR);
      lines.push('');
      lines.push(`  HOW TO FIX (${exp.remediation.length} steps)`);
      lines.push('');
      for (const step of exp.remediation) {
        lines.push(`  ${step.order}. ${step.title}`);
        lines.push(`     ${step.description}`);
        if (step.example) lines.push(`     › ${step.example}`);
        lines.push('');
      }
    }

    lines.push(BAR);
    lines.push('');
    lines.push(`  STANDARD`);
    lines.push(`  ${exp.standard.name}`);
    lines.push(`  ${exp.standard.cweName}`);
    if (exp.standard.owaspUrl) lines.push(`  ${exp.standard.owaspUrl}`);
    lines.push('');

    if (exp.references.length > 0) {
      lines.push(`  REFERENCES`);
      for (const ref of exp.references) lines.push(`  • ${ref.name}: ${ref.url}`);
      lines.push('');
    }

    if (exp.example.docsUrl) {
      lines.push(`  OFFICIAL DOCS`);
      lines.push(`  ${exp.example.docsUrl}`);
      lines.push('');
    }
  } else if (sug) {
    lines.push(`  PROBLEM`);
    lines.push(indent(sug.problem));
    lines.push('');
    lines.push(indent(sug.explanation));
    lines.push('');

    if (sug.currentCodeBad) {
      lines.push(BAR);
      lines.push('');
      lines.push(`  VULNERABLE CODE`);
      lines.push(indentBlock(sug.currentCodeBad));
      lines.push('');
    }
    if (sug.suggestedCodeGood) {
      lines.push(`  SECURE ALTERNATIVE`);
      lines.push(indentBlock(sug.suggestedCodeGood));
      lines.push('');
    }

    if (sug.steps.length > 0) {
      lines.push(BAR);
      lines.push('');
      lines.push(`  HOW TO FIX`);
      lines.push('');
      sug.steps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
      lines.push('');
    }

    lines.push(BAR);
    lines.push('');
    lines.push(`  Est. fix time: ${sug.estimatedFixTimeMinutes} min  ·  Confidence: ${sug.confidence}`);
    if (sug.envVarNeeded)         lines.push(`  Env var needed: ${sug.envVarNeeded}`);
    if (sug.performanceGainMs)    lines.push(`  Performance gain: ~${sug.performanceGainMs}ms`);
    if (sug.relatedIssues?.length) lines.push(`  Related: ${sug.relatedIssues.join(', ')}`);
    lines.push('');
  } else {
    lines.push(`  PROBLEM`);
    lines.push(`  ${issue.message}`);
    lines.push('');
    lines.push(`  No detailed remediation guide found for "${issue.title}".`);
    lines.push(`  Tip: search OWASP docs for this issue type.`);
    lines.push('');
  }

  lines.push(EDGE);
  lines.push('  Use "Aris: Apply Fix" to apply an automated fix, or follow the steps above.');
  lines.push(EDGE);

  return lines.join('\n');
}

function indent(text: string): string {
  return text.split('\n').map(l => `  ${l}`).join('\n');
}

function indentBlock(text: string): string {
  return text.split('\n').map(l => `    ${l}`).join('\n');
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
        if (exp.remediation.length > 0) lines.push(`  Fix:  ${exp.remediation[0].title}`);
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
    outputChannel.appendLine(`Total: ${issues.length} issue(s). Click any item in the Aris sidebar for full remediation.`);
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
    const lineIdx  = Math.max(0, v.line - 1);
    const lineText = doc.lineAt(Math.min(lineIdx, doc.lineCount - 1));
    const range    = new vscode.Range(lineIdx, 0, lineIdx, lineText.text.length);
    const sev      = (v.severity === 'critical' || v.severity === 'high')
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;
    const d = new vscode.Diagnostic(range, `[Aris] ${v.message} (${v.ruleId})`, sev);
    d.source = 'Aris Code';
    items.push(d);
  }

  for (const s of detectedSecrets) {
    const lineIdx  = Math.max(0, s.line - 1);
    const lineText = doc.lineAt(Math.min(lineIdx, doc.lineCount - 1));
    const range    = new vscode.Range(lineIdx, 0, lineIdx, lineText.text.length);
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
    ? `Aris Code: ${total} issue(s) — ${criticalCount} CRITICAL. Click any item in the sidebar for remediation.`
    : `Aris Code: ${total} issue(s). Click any item in the sidebar for fix guidance.`;
  vscode.window.showWarningMessage(message);
}
