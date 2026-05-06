import { useMemo, useState } from 'react';
import { AuditDomainChips } from '../components/audit/AuditDomainChips';
import { AuditFiltersBar } from '../components/audit/AuditFiltersBar';
import { AuditLogsList } from '../components/audit/AuditLogsList';
import { AuditStatsGrid } from '../components/audit/AuditStatsGrid';
import type { AuditLogFilters } from '../components/audit/audit-page-types';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { useAuditLogs } from '../hooks/useAuditLogs';
import {
  AUDIT_DOMAIN_ORDER,
  buildAuditLogInsight,
} from '../lib/audit-log-insights';
import {
  canViewAllAuditLogs,
  canViewAuditLogs,
  getRoleLabel,
} from '../lib/role-access';
import { useAuthStore } from '../stores/auth';

const DEFAULT_FILTERS: AuditLogFilters = {
  action: 'ALL',
  domain: 'ALL',
  resource: 'ALL',
  search: '',
};

export default function AuditLogsPage() {
  const profile = useAuthStore((s) => s.profile);
  const canReadAuditLogs = canViewAuditLogs(profile?.role);
  const canReadAllAuditLogs = canViewAllAuditLogs(profile?.role);
  const { data: logs, isLoading } = useAuditLogs(500, canReadAuditLogs);
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entries = useMemo(() => {
    return (logs ?? []).map((log) => ({
      log,
      insight: buildAuditLogInsight(log),
    }));
  }, [logs]);

  const actions = useMemo(() => Array.from(new Set(entries.map((entry) => entry.log.action))).sort(), [entries]);
  const resourceTypes = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.log.resource_type))).sort(),
    [entries]
  );
  const domains = useMemo(() => {
    const active = new Set(entries.map((entry) => entry.insight.domain));
    return AUDIT_DOMAIN_ORDER.filter((domain) => active.has(domain));
  }, [entries]);
  const filtered = useMemo(() => {
    return entries.filter(({ log, insight }) => {
      if (filters.domain !== 'ALL' && insight.domain !== filters.domain) return false;
      if (filters.action !== 'ALL' && log.action !== filters.action) return false;
      if (filters.resource !== 'ALL' && log.resource_type !== filters.resource) return false;
      if (!filters.search) return true;
      return insight.searchText.includes(filters.search.toLowerCase());
    });
  }, [entries, filters]);
  const stats = useMemo(() => {
    if (!entries.length) return { total: 0, today: 0, actions: 0, resources: 0, linked: 0 };
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      total: entries.length,
      today: entries.filter(({ log }) => new Date(log.created_at) >= todayStart).length,
      actions: new Set(entries.map(({ log }) => log.action)).size,
      resources: new Set(entries.map(({ log }) => log.resource_type)).size,
      linked: entries.filter(({ insight }) => insight.relatedLinks.length > 0).length,
    };
  }, [entries]);
  const hasActiveFilters = filters.domain !== 'ALL' || filters.action !== 'ALL' || filters.resource !== 'ALL' || filters.search !== '';

  return (
    <>
      <Header
        title="Audit Logs"
        subtitle={
          !canReadAuditLogs
            ? 'Restricted to operators and admins'
            : canReadAllAuditLogs
              ? `${logs?.length ?? 0} events recorded across the platform`
              : `${logs?.length ?? 0} events from your own activity`
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canReadAuditLogs ? (
          <RoleAccessNotice
            title={`${getRoleLabel(profile?.role)} role cannot view audit logs`}
            detail="Audit access is restricted in the UI to operators for their own actions and admins for the full platform trail."
            tone="warning"
          />
        ) : (
          <>
            <div className="mb-5">
              <RoleAccessNotice
                title={canReadAllAuditLogs ? 'Admin audit scope' : 'Operator audit scope'}
                detail={
                  canReadAllAuditLogs
                    ? 'You are viewing the full platform audit trail across actors and resources.'
                    : 'You are viewing only audit events where you are the recorded actor.'
                }
              />
            </div>
            <AuditStatsGrid stats={stats} />
            <AuditDomainChips
              domains={domains}
              entries={entries}
              selectedDomain={filters.domain}
              onChange={(domain) => setFilters({ ...filters, domain })}
            />
            <AuditFiltersBar
              actions={actions}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              resourceTypes={resourceTypes}
              resultCount={filtered.length}
              onClear={() => setFilters(DEFAULT_FILTERS)}
              onChange={setFilters}
            />
            <AuditLogsList
              entries={entries}
              expandedId={expandedId}
              filtered={filtered}
              isLoading={isLoading}
              onToggleExpanded={(logId) => setExpandedId(expandedId === logId ? null : logId)}
            />
          </>
        )}
      </div>
    </>
  );
}
