import { Camera, Code, FileText } from 'lucide-react';
export {
  RunArtifactsStepEvidence,
  RunArtifactsUnlinked,
} from './run-artifacts-evidence-sections';

export function RunArtifactsStats({
  focusStepId,
  stats,
}: {
  focusStepId: string | null;
  stats: {
    json: number;
    logs: number;
    screenshots: number;
    stepsWithEvidence: number;
    total: number;
  };
}) {
  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Run Evidence</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {stats.total} artifact{stats.total !== 1 ? 's' : ''} linked to {stats.stepsWithEvidence} step{stats.stepsWithEvidence !== 1 ? 's' : ''}
        </p>
        {focusStepId && (
          <p className="text-xs text-amber-700 mt-2">
            Focused from audit trail on step <span className="font-mono">{focusStepId}</span>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Artifacts</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-600" />
            <p className="text-xs text-sky-700">Screenshots</p>
          </div>
          <p className="text-lg font-semibold text-sky-900 mt-1">{stats.screenshots}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <p className="text-xs text-gray-700">Logs</p>
          </div>
          <p className="text-lg font-semibold text-gray-900 mt-1">{stats.logs}</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-teal-600" />
            <p className="text-xs text-teal-700">JSON Results</p>
          </div>
          <p className="text-lg font-semibold text-teal-900 mt-1">{stats.json}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Steps With Evidence</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{stats.stepsWithEvidence}</p>
        </div>
      </div>
    </>
  );
}
