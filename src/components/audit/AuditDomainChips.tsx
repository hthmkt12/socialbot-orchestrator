import { getAuditDomainLabel, type AuditDomain } from '../../lib/audit-log-insights';
import type { AuditLogEntry, AuditLogFilters } from './audit-page-types';

interface AuditDomainChipsProps {
  domains: AuditDomain[];
  entries: AuditLogEntry[];
  selectedDomain: AuditLogFilters['domain'];
  onChange: (domain: AuditLogFilters['domain']) => void;
}

export function AuditDomainChips({
  domains,
  entries,
  selectedDomain,
  onChange,
}: AuditDomainChipsProps) {
  if (domains.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onChange('ALL')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          selectedDomain === 'ALL'
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
        }`}
      >
        All Domains ({entries.length})
      </button>
      {domains.map((domain) => {
        const count = entries.filter((entry) => entry.insight.domain === domain).length;
        return (
          <button
            key={domain}
            onClick={() => onChange(domain)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedDomain === domain
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-sky-200'
            }`}
          >
            {getAuditDomainLabel(domain)} ({count})
          </button>
        );
      })}
    </div>
  );
}
