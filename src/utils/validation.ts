export function validatePrompt(prompt: string): void {
  const trimmed = prompt.trim();
  if (trimmed.length < 10) {
    throw new Error('El prompt debe tener al menos 10 caracteres.');
  }
  if (trimmed.length > 1000) {
    throw new Error('El prompt no puede superar 1000 caracteres.');
  }
}

export function sanitizeCode(code: string): string {
  return code.trim();
}
