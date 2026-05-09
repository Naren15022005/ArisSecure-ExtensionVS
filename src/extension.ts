import * as vscode from 'vscode';
import { CodeGenerationService } from './services/CodeGenerationService';
import { SecurityScanningService, Vulnerability } from './services/SecurityScanningService';
import { SecretDetectionService, Secret } from './services/SecretDetectionService';
import { validatePrompt } from './utils/validation';

let outputChannel: vscode.OutputChannel;
const diagnostics = vscode.languages.createDiagnosticCollection('aris-code');

const codeGen = new CodeGenerationService();
const security = new SecurityScanningService();
const secrets = new SecretDetectionService();

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Aris Code');

  context.subscriptions.push(
    diagnostics,
    vscode.commands.registerCommand('arisCode.generate', generateCommand),
    vscode.commands.registerCommand('arisCode.scanFile', scanFileCommand)
  );

  outputChannel.appendLine('Aris Code activated.');
}

export function deactivate(): void {
  outputChannel?.dispose();
}

async function generateCommand(): Promise<void> {
  const prompt = await vscode.window.showInputBox({
    title: 'Aris Code - Generate Secure Code',
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

  if (!prompt) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Aris Code',
      cancellable: false,
    },
    async progress => {
      progress.report({ message: 'Generating code...' });

      let code: string;
      try {
        code = await codeGen.generate(prompt);
      } catch (err) {
        vscode.window.showErrorMessage(`Aris Code: ${(err as Error).message}`);
        return;
      }

      progress.report({ message: 'Scanning for vulnerabilities...' });

      const [vulns, detectedSecrets] = await Promise.all([
        security.scan(code),
        secrets.detect(code),
      ]);

      writeResultsToOutput(code, vulns, detectedSecrets);
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
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Aris Code: Scanning...',
      cancellable: false,
    },
    async () => {
      const [vulns, detectedSecrets] = await Promise.all([
        security.scan(code),
        secrets.detect(code),
      ]);

      applyDiagnostics(editor.document, vulns, detectedSecrets);
      showScanSummary(vulns, detectedSecrets);
    }
  );
}

function writeResultsToOutput(
  code: string,
  vulns: Vulnerability[],
  detectedSecrets: Secret[]
): void {
  outputChannel.clear();
  outputChannel.appendLine('='.repeat(50));
  outputChannel.appendLine('Aris Code - Scan Results');
  outputChannel.appendLine('='.repeat(50));
  outputChannel.appendLine('');
  outputChannel.appendLine('--- Generated Code ---');
  outputChannel.appendLine(code);
  outputChannel.appendLine('');
  outputChannel.appendLine('--- Security Scan ---');

  if (vulns.length === 0 && detectedSecrets.length === 0) {
    outputChannel.appendLine('No vulnerabilities or secrets detected.');
  } else {
    for (const v of vulns) {
      outputChannel.appendLine(
        `[${v.severity.toUpperCase()}] Line ${v.line}: ${v.message} (${v.ruleId})`
      );
    }
    for (const s of detectedSecrets) {
      outputChannel.appendLine(
        `[SECRET] Line ${s.line}: ${s.type} detected - use environment variables instead`
      );
    }
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
    const severity =
      v.severity === 'critical' || v.severity === 'high'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
    const d = new vscode.Diagnostic(range, `[Aris] ${v.message} (${v.ruleId})`, severity);
    d.source = 'Aris Code';
    items.push(d);
  }

  for (const s of detectedSecrets) {
    const lineIdx = Math.max(0, s.line - 1);
    const lineText = doc.lineAt(Math.min(lineIdx, doc.lineCount - 1));
    const range = new vscode.Range(lineIdx, 0, lineIdx, lineText.text.length);
    const d = new vscode.Diagnostic(
      range,
      `[Aris] ${s.type} detected - use environment variables instead`,
      vscode.DiagnosticSeverity.Error
    );
    d.source = 'Aris Code';
    items.push(d);
  }

  diagnostics.set(doc.uri, items);
}

function showScanSummary(vulns: Vulnerability[], detectedSecrets: Secret[]): void {
  const total = vulns.length + detectedSecrets.length;

  if (total === 0) {
    vscode.window.showInformationMessage('Aris Code: No issues detected.');
    return;
  }

  const criticalCount = vulns.filter(v => v.severity === 'critical').length;
  const message =
    criticalCount > 0
      ? `Aris Code: ${total} issue(s) found - ${criticalCount} CRITICAL. See Problems panel.`
      : `Aris Code: ${total} issue(s) found. See Problems panel.`;

  vscode.window.showWarningMessage(message);
}
