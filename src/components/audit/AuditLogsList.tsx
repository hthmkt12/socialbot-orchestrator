import { Filter, ScrollText } from 'lucide-react';
import AuditLogRow from './AuditLogRow';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import type { AuditLogEntry } from './audit-page-types';

interface AuditLogsListProps {
  entries: AuditLogEntry[];
  expandedId: string | null;
  filtered: AuditLogEntry[];
  isLoading: boolean;
  onToggleExpanded: (logId: string) => void;
}

export function AuditLogsList({
  entries,
  expandedId,
  filtered,
  isLoading,
  onToggleExpanded,
}: AuditLogsListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!entries.length) {
    return (
      <EmptyState
        icon={<ScrollText className="w-6 h-6" />}
        title="No audit logs"
        description="Activity will be recorded here as you use the platform."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <Filter className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No logs match your filters</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-2">
      {filtered.map(({ log }) => (
        <AuditLogRow
          key={log.id}
          log={log}
          expanded={expandedId === log.id}
          onToggle={() => onToggleExpanded(log.id)}
        />
      ))}
    </div>
  );
}
