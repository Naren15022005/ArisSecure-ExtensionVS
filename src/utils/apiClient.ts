import axios from 'axios';
import * as vscode from 'vscode';

export function createOllamaClient() {
  const cfg = vscode.workspace.getConfiguration('arisCode');
  const host = cfg.get<string>('ollamaHost') || 'http://localhost:11434';

  return axios.create({
    baseURL: host,
    timeout: 60_000,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createSemgrepClient() {
  const cfg = vscode.workspace.getConfiguration('arisCode');
  const token = cfg.get<string>('semgrepApiToken') || '';

  return axios.create({
    baseURL: 'https://api.semgrep.dev/api',
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Token ${token}` }),
    },
  });
}
