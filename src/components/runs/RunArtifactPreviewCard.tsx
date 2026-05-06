import Badge from '../ui/Badge';
import type { RunArtifactPreview } from '../../lib/run-artifacts';

export function RunArtifactPreviewCard({ artifact }: { artifact: RunArtifactPreview }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={artifact.artifact.type === 'SCREENSHOT' ? 'blue' : artifact.previewKind === 'json' ? 'teal' : 'gray'}>
            {artifact.artifact.type}
          </Badge>
          {artifact.source && (
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{artifact.source}</span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">{(artifact.artifact.size / 1024).toFixed(1)} KB</span>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-gray-500 font-mono break-all">{artifact.artifact.storage_key}</p>
        {artifact.timestamp && (
          <p className="text-[10px] text-gray-400">{new Date(artifact.timestamp).toLocaleString()}</p>
        )}
      </div>

      {artifact.imageSrc && (
        <img
          src={artifact.imageSrc}
          alt={`Artifact ${artifact.artifact.id}`}
          className="w-full rounded-lg border border-gray-200 bg-gray-50"
        />
      )}

      {!artifact.imageSrc && artifact.previewText && (
        <pre className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-700 whitespace-pre-wrap">
          {artifact.previewText}
        </pre>
      )}

      {!artifact.imageSrc && !artifact.previewText && (
        <pre className="max-h-32 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-500 whitespace-pre-wrap">
          {JSON.stringify(artifact.rawMetadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
