import { Archive, CheckCircle, FileJson } from 'lucide-react';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import type { MacroDefinition } from '../../contracts/macro';
import type { MacroVersion } from '../../lib/database.types';
import { macroDetailVersionStatusVariant } from './macro-detail-step-config';

interface MacroDetailVersionsPanelProps {
  activatePending: boolean;
  archivePending: boolean;
  canEditMacros: boolean;
  versions: MacroVersion[] | undefined;
  versionsLoading: boolean;
  onActivate: (versionId: string) => void;
  onArchive: (versionId: string) => void;
  onViewJson: (definition: MacroDefinition) => void;
}

export function MacroDetailVersionsPanel({
  activatePending,
  archivePending,
  canEditMacros,
  versions,
  versionsLoading,
  onActivate,
  onArchive,
  onViewJson,
}: MacroDetailVersionsPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Versions</h3>
        <p className="text-xs text-gray-500 mt-0.5">{versions?.length ?? 0} version{(versions?.length ?? 0) !== 1 ? 's' : ''}</p>
      </div>

      {versionsLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !versions?.length ? (
        <p className="px-5 py-8 text-sm text-gray-500 text-center">No versions yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {versions.map((version) => (
            <MacroDetailVersionRow
              key={version.id}
              activatePending={activatePending}
              archivePending={archivePending}
              canEditMacros={canEditMacros}
              version={version}
              onActivate={onActivate}
              onArchive={onArchive}
              onViewJson={onViewJson}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MacroDetailVersionRow({
  activatePending,
  archivePending,
  canEditMacros,
  version,
  onActivate,
  onArchive,
  onViewJson,
}: Omit<MacroDetailVersionsPanelProps, 'versions' | 'versionsLoading'> & { version: MacroVersion }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          version.status === 'ACTIVE' ? 'bg-emerald-50' : version.status === 'DRAFT' ? 'bg-amber-50' : 'bg-gray-50'
        }`}>
          <span className={`text-sm font-bold ${
            version.status === 'ACTIVE' ? 'text-emerald-600' : version.status === 'DRAFT' ? 'text-amber-600' : 'text-gray-500'
          }`}>v{version.version_number}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">Version {version.version_number}</span>
            <Badge variant={macroDetailVersionStatusVariant[version.status] as 'green'}>{version.status}</Badge>
          </div>
          <p className="text-xs text-gray-500">Created {new Date(version.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onViewJson(version.definition_json)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <FileJson className="w-3.5 h-3.5" /> View JSON
        </button>
        {version.status !== 'ACTIVE' && (
          <>
            <button onClick={() => onActivate(version.id)} disabled={activatePending || !canEditMacros} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
              <CheckCircle className="w-3.5 h-3.5" /> Activate
            </button>
            {version.status !== 'ARCHIVED' && (
              <button onClick={() => onArchive(version.id)} disabled={archivePending || !canEditMacros} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
