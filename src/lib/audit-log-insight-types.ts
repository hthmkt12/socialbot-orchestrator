export type AuditDomain = 'RUNS' | 'APPROVALS' | 'MACROS' | 'DEVICES' | 'DEVICE_GROUPS' | 'SYSTEM';
export type AuditTone = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange' | 'teal';

export interface AuditLink {
  key: string;
  label: string;
  to: string;
  tone: AuditTone;
}

export interface AuditHighlight {
  key: string;
  label: string;
  value: string;
  tone: AuditTone;
}

export interface AuditLogInsight {
  domain: AuditDomain;
  domainLabel: string;
  actionLabel: string;
  resourceLabel: string;
  summary: string;
  highlights: AuditHighlight[];
  relatedLinks: AuditLink[];
  searchText: string;
}

export const AUDIT_DOMAIN_ORDER: AuditDomain[] = [
  'RUNS',
  'APPROVALS',
  'MACROS',
  'DEVICES',
  'DEVICE_GROUPS',
  'SYSTEM',
];
