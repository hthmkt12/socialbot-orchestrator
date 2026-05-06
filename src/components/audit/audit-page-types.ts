import type { AuditDomain, AuditLogInsight } from '../../lib/audit-log-insights';
import type { AuditLog } from '../../lib/database.types';

export interface AuditLogEntry {
  log: AuditLog;
  insight: AuditLogInsight;
}

export interface AuditLogStats {
  actions: number;
  linked: number;
  resources: number;
  today: number;
  total: number;
}

export interface AuditLogFilters {
  action: string;
  domain: 'ALL' | AuditDomain;
  resource: string;
  search: string;
}
