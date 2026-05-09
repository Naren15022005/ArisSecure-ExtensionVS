import * as vscode from 'vscode';

let channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Aris Code');
  }
  return channel;
}

export function log(message: string): void {
  const ts = new Date().toISOString();
  getChannel().appendLine(`[${ts}] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  log(`ERROR: ${message}${detail ? ` — ${detail}` : ''}`);
}

export function disposeLogger(): void {
  channel?.dispose();
  channel = null;
}
