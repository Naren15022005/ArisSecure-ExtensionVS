export type FixType = 'REPLACE' | 'INSERT' | 'DELETE' | 'MULTI_FILE';
export type InsertAt = 'ABOVE' | 'BELOW' | 'BEGINNING' | 'END';

export interface AutoFixAction {
  id: string;
  issueId: string;
  type: FixType;
  description: string;
  find?: string | RegExp;
  replace?: string;
  line?: number;
  insertAt?: InsertAt;
  insertContent?: string;
  files?: Map<string, AutoFixAction>;
  requiresConfirmation: boolean;
  previewChanges?: boolean;
  appliedCount?: number;
}
