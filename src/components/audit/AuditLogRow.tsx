import { ChevronRight } from 'lucide-react';
import type { AuditLog } from '../../lib/database.types';
import { buildAuditLogInsight } from '../../lib/audit-log-insights';
import Badge from '../ui/Badge';
import { AuditLogRowDetails } from './audit-log-row-details';
import {
  actionConfig,
  defaultAuditRowConfig,
  getTimeAgo,
  resourceIcons,
  toneSurfaceClasses,
} from './audit-log-row-config';

interface AuditLogRowProps {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}

export default function AuditLogRow({ log, expanded, onToggle }: AuditLogRowProps) {
  const config = actionConfig[log.action] ?? defaultAuditRowConfig;
  const ActionIcon = config.icon;
  const ResourceIcon = resourceIcons[log.resource_type] ?? defaultAuditRowConfig.icon;
  const hasMeta = log.metadata_json && Object.keys(log.metadata_json).length > 0;
  const insight = buildAuditLogInsight(log);

  return (
    <div className={`bg-white rounded-xl border transition-all ${expanded ? 'border-sky-200 shadow-sm' : 'border-gray-200'}`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneSurfaceClasses[config.variant]}`}>
          <ActionIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{insight.actionLabel}</span>
            <Badge variant={config.variant}>{insight.domainLabel}</Badge>
            <Badge variant="gray">{insight.resourceLabel}</Badge>
          </div>
          <p className="text-sm text-gray-600">{insight.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ResourceIcon className="w-3 h-3" />
              {log.resource_type}
            </span>
            <span className="font-mono text-[10px] text-gray-400">{log.resource_id.slice(0, 12)}</span>
            {insight.relatedLinks.length > 0 && (
              <span className="text-[10px] uppercase tracking-wide text-gray-400">
                {insight.relatedLinks.length} linked context{insight.relatedLinks.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {insight.highlights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {insight.highlights.map((highlight) => (
                <Badge key={highlight.key} variant={highlight.tone}>
                  {highlight.label}: {highlight.value}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="text-right flex-shrink-0 flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">{getTimeAgo(log.created_at)}</p>
          </div>
          {(hasMeta || insight.relatedLinks.length > 0) && (
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          )}
        </div>
      </button>

      {expanded && (
        <AuditLogRowDetails hasMeta={hasMeta} insight={insight} log={log} />
      )}
    </div>
  );
}
