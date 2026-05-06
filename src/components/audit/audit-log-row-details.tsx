import { Link } from 'react-router-dom';
import type { AuditLogInsight } from '../../lib/audit-log-insights';
import type { AuditLog } from '../../lib/database.types';
import { toneButtonClasses } from './audit-log-row-config';

interface AuditLogRowDetailsProps {
  hasMeta: boolean;
  insight: AuditLogInsight;
  log: AuditLog;
}

export function AuditLogRowDetails({ hasMeta, insight, log }: AuditLogRowDetailsProps) {
  return (
    <div className="px-5 pb-4 space-y-4">
      {insight.relatedLinks.length > 0 && (
        <div className="bg-sky-50 rounded-lg border border-sky-100 p-4">
          <h5 className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider mb-3">
            Linked Context
          </h5>
          <div className="flex flex-wrap gap-2">
            {insight.relatedLinks.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className={`inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${toneButtonClasses[link.tone]}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {hasMeta && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Metadata</h5>
          <div className="space-y-1.5">
            {Object.entries(log.metadata_json).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <span className="text-xs text-gray-500 font-mono flex-shrink-0">{key}</span>
                <span className="text-xs font-medium text-gray-700 text-right break-all">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
