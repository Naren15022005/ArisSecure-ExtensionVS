import * as vscode from 'vscode';
import type { IssueData } from '../views/IssueTreeProvider';
import type { AutoFixAction } from '../types/autofix';
import * as fs from 'fs';
import * as path from 'path';

const SECRET_IDS = new Set([
  'API_KEY', 'AWS_ACCESS_KEY', 'PASSWORD', 'DB_URL', 'PRIVATE_KEY',
  'GITHUB_TOKEN', 'GENERIC_SECRET',
]);

export class AutoFixService {
  generateFix(issue: IssueData): AutoFixAction | null {
    const id = issue.title;

    if (issue.type === 'secret' || SECRET_IDS.has(id)) {
      const envName = id.replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
      return {
        id: `fix-${id}-${issue.line}`,
        issueId: id,
        type: 'REPLACE',
        description: `Replace hardcoded secret with process.env.${envName}`,
        find: /=\s*(['"])([^'"]{4,})\1/,
        replace: `= process.env.${envName}`,
        line: issue.line,
        requiresConfirmation: true,
        previewChanges: true,
      };
    }

    if (id === 'CONSOLE_LOG') {
      return {
        id: `fix-CONSOLE_LOG-${issue.line}`,
        issueId: id,
        type: 'DELETE',
        description: 'Remove console.log statement',
        line: issue.line,
        requiresConfirmation: false,
      };
    }

    if (id === 'TODO_FIXME') {
      return {
        id: `fix-TODO_FIXME-${issue.line}`,
        issueId: id,
        type: 'REPLACE',
        description: 'Replace TODO/FIXME with a tracked issue reference',
        find: /\/\/\s*(?:TODO|FIXME):?\s*/i,
        replace: '// TRACKED: ',
        line: issue.line,
        requiresConfirmation: false,
      };
    }

    if (id === 'EMPTY_CATCH') {
      return {
        id: `fix-EMPTY_CATCH-${issue.line}`,
        issueId: id,
        type: 'REPLACE',
        description: 'Add error logging to empty catch block',
        find: /catch\s*\(\s*(\w+)\s*\)\s*\{\s*\}/,
        replace: 'catch ($1) { console.error($1); }',
        line: issue.line,
        requiresConfirmation: false,
      };
    }

    if (id === 'SENSITIVE_DATA_LOG') {
      return {
        id: `fix-SENSITIVE_DATA_LOG-${issue.line}`,
        issueId: id,
        type: 'DELETE',
        description: 'Remove statement that logs sensitive data',
        line: issue.line,
        requiresConfirmation: true,
      };
    }

    if (id === 'DEBUG_ENABLED') {
      return {
        id: `fix-DEBUG_ENABLED-${issue.line}`,
        issueId: id,
        type: 'REPLACE',
        description: 'Gate debug flag behind NODE_ENV check',
        find: /debug\s*:\s*true/i,
        replace: "debug: process.env.NODE_ENV !== 'production'",
        line: issue.line,
        requiresConfirmation: false,
      };
    }

    return null;
  }

  async applyFix(fix: AutoFixAction, editor: vscode.TextEditor): Promise<boolean> {
    switch (fix.type) {
      case 'REPLACE': return this._doReplace(fix, editor);
      case 'INSERT':  return this._doInsert(fix, editor);
      case 'DELETE':  return this._doDelete(fix, editor);
      default:        return false;
    }
  }

  async ensureEnvExample(workspaceRoot: string): Promise<void> {
    const envExample = path.join(workspaceRoot, '.env.example');
    if (!fs.existsSync(envExample)) {
      fs.writeFileSync(envExample, '# Copy this file to .env and fill in your values\n');
    }

    const gitignore = path.join(workspaceRoot, '.gitignore');
    const content = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf-8') : '';
    if (!content.includes('.env')) {
      fs.appendFileSync(gitignore, '\n.env\n');
    }
  }

  private async _doReplace(fix: AutoFixAction, editor: vscode.TextEditor): Promise<boolean> {
    if (fix.line == null || !fix.find) return false;
    const lineIdx = Math.max(0, fix.line - 1);
    if (lineIdx >= editor.document.lineCount) return false;

    const lineText = editor.document.lineAt(lineIdx).text;
    const pattern = fix.find instanceof RegExp ? fix.find : new RegExp(fix.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const newText = lineText.replace(pattern, fix.replace ?? '');
    if (newText === lineText) return false;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(editor.document.uri, editor.document.lineAt(lineIdx).range, newText);
    return vscode.workspace.applyEdit(edit);
  }

  private async _doInsert(fix: AutoFixAction, editor: vscode.TextEditor): Promise<boolean> {
    if (fix.line == null || !fix.insertContent) return false;
    const lineIdx = Math.max(0, fix.line - 1);
    const pos = fix.insertAt === 'ABOVE'
      ? new vscode.Position(lineIdx, 0)
      : new vscode.Position(lineIdx + 1, 0);

    const edit = new vscode.WorkspaceEdit();
    edit.insert(editor.document.uri, pos, fix.insertContent + '\n');
    return vscode.workspace.applyEdit(edit);
  }

  private async _doDelete(fix: AutoFixAction, editor: vscode.TextEditor): Promise<boolean> {
    if (fix.line == null) return false;
    const lineIdx = Math.max(0, fix.line - 1);
    if (lineIdx >= editor.document.lineCount) return false;

    const edit = new vscode.WorkspaceEdit();
    const lineRange = editor.document.lineAt(lineIdx).rangeIncludingLineBreak;
    edit.delete(editor.document.uri, lineRange);
    return vscode.workspace.applyEdit(edit);
  }
}
