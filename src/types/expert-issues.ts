import type { ExplanationData } from '../services/ExplanationService';

export type Domain = 'Security' | 'Quality' | 'DevOps' | 'Scalability';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ExpertIssue {
  id: string;
  domain: Domain;
  severity: Severity;
  title: string;
  message: string;
  line: number;
  explanation?: ExplanationData;
}

export interface ExpertPattern {
  id: string;
  domain: Domain;
  severity: Severity;
  message: string;
  pattern: RegExp;
}
