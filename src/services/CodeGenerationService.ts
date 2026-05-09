import * as vscode from 'vscode';
import axios from 'axios';

export class CodeGenerationService {
  async generate(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('arisCode');
    const provider = cfg.get<string>('llmProvider') ?? 'ollama';

    return provider === 'openai'
      ? this.generateOpenAI(prompt, cfg.get<string>('openaiApiKey') ?? '')
      : this.generateOllama(prompt, cfg);
  }

  private async generateOllama(
    prompt: string,
    cfg: vscode.WorkspaceConfiguration
  ): Promise<string> {
    const host = cfg.get<string>('ollamaHost') ?? 'http://localhost:11434';
    const model = cfg.get<string>('ollamaModel') ?? 'llama2';
    const temperature = cfg.get<number>('temperature') ?? 0.7;

    const systemPrompt =
      'You are a secure code generator. Return ONLY the code, no explanations or markdown. ' +
      'Avoid SQL injection, XSS, hardcoded secrets, and other OWASP Top 10 vulnerabilities.';

    try {
      const response = await axios.post(
        `${host}/api/generate`,
        { model, prompt: `${systemPrompt}\n\nTask: ${prompt}`, stream: false, options: { temperature } },
        { timeout: 60_000 }
      );
      return (response.data.response as string).trim();
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new Error('No se puede conectar a Ollama. Ejecuta: ollama serve');
      }
      throw new Error(`Error generando código: ${(error as Error).message}`);
    }
  }

  private async generateOpenAI(prompt: string, apiKey: string): Promise<string> {
    if (!apiKey) {
      throw new Error('Configura tu OpenAI API Key en Settings (Aris Code: OpenAI API Key).');
    }
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Return ONLY code. Avoid OWASP Top 10 vulnerabilities.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        },
        { timeout: 60_000, headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return (response.data.choices[0].message.content as string).trim();
    } catch (error) {
      throw new Error(`Error con OpenAI: ${(error as Error).message}`);
    }
  }
}
