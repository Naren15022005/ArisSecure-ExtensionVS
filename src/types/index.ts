export type { Vulnerability } from '../services/SecurityScanningService';
export type { Secret } from '../services/SecretDetectionService';

export interface ScanResult {
  code: string;
  vulnerabilities: import('../services/SecurityScanningService').Vulnerability[];
  secrets: import('../services/SecretDetectionService').Secret[];
}
