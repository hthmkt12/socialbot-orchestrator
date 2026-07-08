import Badge from '../ui/Badge';
import { useArtifactUrl } from '../../hooks/use-artifact-url';
import Spinner from '../ui/Spinner';
import type { RunArtifactPreview } from '../../lib/run-artifacts';

const evidenceVariant: Record<RunArtifactPreview['evidenceKind'], 'blue' | 'teal' | 'gray'> = {
  screenshot: 'blue',
  log: 'gray',
  json: 'teal',
  unknown: 'gray',
};

export function RunArtifactPreviewCard({ artifact }: { artifact: RunArtifactPreview }) {
  const createdAt = artifact.timestamp ?? artifact.artifact.created_at;
  const { url: storageUrl, isLoading: isUrlLoading, error: urlError } = useArtifactUrl(artifact.artifact as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  
  const finalImageSrc = artifact.imageSrc || (artifact.previewKind === 'image' ? storageUrl : null);
  const finalPreviewText = artifact.previewText || (artifact.previewKind === 'text' && storageUrl ? 'Text content available via storage URL (click to download)' : null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={evidenceVariant[artifact.evidenceKind]}>{artifact.evidenceLabel}</Badge>
          <span className="text-[10px] text-gray-400 font-mono">{artifact.artifact.type}</span>
          {artifact.source && (
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{artifact.source}</span>
          )}
          {artifact.linkageStatus !== 'linked' && <Badge variant="orange">Linkage warning</Badge>}
          {artifact.isExpired && <Badge variant="orange">Expired</Badge>}
          {!artifact.previewAvailable && <Badge variant="orange">Preview warning</Badge>}
        </div>
        <span className="text-[10px] text-gray-400">{(artifact.artifact.size / 1024).toFixed(1)} KB</span>
      </div>

      <div className="space-y-1 text-[10px] text-gray-500">
        <p className="text-[10px] text-gray-500 font-mono break-all">{artifact.artifact.storage_key}</p>
        <p>run: <span className="font-mono">{artifact.artifact.workflow_run_id.slice(0, 8)}</span></p>
        <p>device: <span className="font-mono">{artifact.artifact.device_id?.slice(0, 8) ?? 'missing'}</span></p>
        <p>step: <span className="font-mono">{artifact.stepId ?? 'missing'}</span></p>
        <p>created: {new Date(createdAt).toLocaleString()}</p>
        <p>storage: {artifact.storageModeLabel} · {artifact.storageStatusLabel}</p>
        {artifact.retentionExpiresAt && (
          <p>retention: {new Date(artifact.retentionExpiresAt).toLocaleString()}</p>
        )}
        {artifact.linkageStatus !== 'linked' && <p className="text-amber-700">{artifact.linkageMessage}</p>}
      </div>

      {isUrlLoading && <div className="p-4 flex justify-center"><Spinner size="sm" /></div>}
      {urlError && <div className="p-4 text-red-500 text-xs">Failed to load image from storage</div>}
      
      {finalImageSrc && !isUrlLoading && (
        <img
          src={finalImageSrc}
          alt={`Artifact ${artifact.artifact.id}`}
          className="w-full rounded-lg border border-gray-200 bg-gray-50"
        />
      )}

      {!finalImageSrc && finalPreviewText && (
        <pre className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-700 whitespace-pre-wrap">
          {finalPreviewText}
        </pre>
      )}

      {!finalImageSrc && !finalPreviewText && !isUrlLoading && (
        <div className="space-y-2">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {artifact.previewAvailabilityLabel}: {artifact.previewAvailabilityReason}
          </p>
          <pre className="max-h-32 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-500 whitespace-pre-wrap">
            {artifact.rawMetadataPreviewText}
          </pre>
        </div>
      )}
    </div>
  );
}
