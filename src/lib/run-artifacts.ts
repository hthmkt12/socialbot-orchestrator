import type { Artifact } from './database.types';

export type RunArtifactPreviewKind = 'image' | 'text' | 'json' | 'binary';
export type RunArtifactEvidenceKind = 'screenshot' | 'log' | 'json' | 'unknown';
export type RunArtifactLinkageStatus = 'linked' | 'missing-device' | 'missing-step' | 'missing-device-and-step';

const MAX_INLINE_PREVIEW_BYTES = 512_000;

export interface RunArtifactPreview {
  artifact: Artifact;
  stepId: string | null;
  timestamp: string | null;
  source: string | null;
  imageSrc: string | null;
  previewText: string | null;
  previewKind: RunArtifactPreviewKind;
  rawMetadata: Record<string, unknown>;
  evidenceLabel: string;
  evidenceKind: RunArtifactEvidenceKind;
  linkageStatus: RunArtifactLinkageStatus;
  linkageMessage: string;
  storageModeLabel: string;
  storageStatusLabel: string;
  previewAvailable: boolean;
  previewAvailabilityLabel: string;
  previewAvailabilityReason: string | null;
  rawMetadataPreviewText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asValidTimestamp(value: unknown): string | null {
  const timestamp = asString(value);
  if (!timestamp) return null;
  return Number.isNaN(new Date(timestamp).getTime()) ? null : timestamp;
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getEvidenceDisplay(type: Artifact['type']): { evidenceKind: RunArtifactEvidenceKind; evidenceLabel: string } {
  if (type === 'SCREENSHOT') return { evidenceKind: 'screenshot', evidenceLabel: 'Screenshot' };
  if (type === 'LOG_BLOB') return { evidenceKind: 'log', evidenceLabel: 'Log' };
  if (type === 'JSON_RESULT') return { evidenceKind: 'json', evidenceLabel: 'JSON result' };
  return { evidenceKind: 'unknown', evidenceLabel: 'Unknown evidence' };
}

function getLinkageStatus(deviceId: string | null, stepId: string | null) {
  if (!deviceId && !stepId) {
    return {
      linkageStatus: 'missing-device-and-step' as const,
      linkageMessage: 'Missing source device linkage and stepId metadata for this artifact.',
    };
  }
  if (!deviceId) {
    return {
      linkageStatus: 'missing-device' as const,
      linkageMessage: 'Missing source device linkage for this artifact.',
    };
  }
  if (!stepId) {
    return {
      linkageStatus: 'missing-step' as const,
      linkageMessage: 'Missing source stepId metadata for this artifact.',
    };
  }
  return {
    linkageStatus: 'linked' as const,
    linkageMessage: 'Linked to source run, device, and step.',
  };
}

function getPreviewAvailability(previewKind: RunArtifactPreviewKind, hasPreview: boolean, isOversized: boolean) {
  if (isOversized) {
    return {
      previewAvailable: false,
      previewAvailabilityLabel: 'Inline preview omitted',
      previewAvailabilityReason: 'Artifact is too large for inline pilot UI preview; metadata summary is shown instead.',
    };
  }
  if (hasPreview) {
    return {
      previewAvailable: true,
      previewAvailabilityLabel: previewKind === 'image' ? 'Inline image preview' : 'Inline preview available',
      previewAvailabilityReason: null,
    };
  }
  return {
    previewAvailable: false,
    previewAvailabilityLabel: 'Inline preview missing',
    previewAvailabilityReason: 'Artifact row has no inline preview payload; raw metadata is shown for diagnosis.',
  };
}

function readJsonPayload(metadata: Record<string, unknown>) {
  if (Object.prototype.hasOwnProperty.call(metadata, 'json')) return metadata.json;
  if (Object.prototype.hasOwnProperty.call(metadata, 'payload')) return metadata.payload;
  return undefined;
}

function buildRawMetadataPreviewText(metadata: Record<string, unknown>, omitInlinePayload: boolean) {
  if (!omitInlinePayload) return stringifyJson(metadata);
  const safeMetadata = { ...metadata };
  for (const key of ['base64', 'text', 'json', 'payload']) {
    if (Object.prototype.hasOwnProperty.call(safeMetadata, key)) {
      safeMetadata[key] = '[omitted from inline preview]';
    }
  }
  return stringifyJson(safeMetadata);
}

export function buildRunArtifactStepKey(deviceId: string | null, stepId: string | null) {
  return deviceId && stepId ? `${deviceId}::${stepId}` : null;
}

export function normalizeRunArtifact(artifact: Artifact): RunArtifactPreview {
  const metadata = isRecord(artifact.metadata_json) ? artifact.metadata_json : {};
  const stepId = asString(metadata.stepId);
  const base64 = asString(metadata.base64);
  const text = asString(metadata.text);
  const timestamp = asValidTimestamp(metadata.timestamp) ?? artifact.created_at;
  const source = asString(metadata.source);
  const jsonPayload = readJsonPayload(metadata);
  const isOversized = artifact.size > MAX_INLINE_PREVIEW_BYTES;

  const imageSrc = artifact.type === 'SCREENSHOT' && base64 && !isOversized
    ? `data:${artifact.content_type};base64,${base64}`
    : null;

  const previewText = jsonPayload !== undefined && !isOversized
    ? stringifyJson(jsonPayload)
    : isOversized
      ? null
      : text;

  const previewKind: RunArtifactPreviewKind = imageSrc
    ? 'image'
    : artifact.type === 'JSON_RESULT' && jsonPayload !== undefined
      ? 'json'
      : previewText
        ? 'text'
        : 'binary';
  const evidenceDisplay = getEvidenceDisplay(artifact.type);
  const linkage = getLinkageStatus(artifact.device_id, stepId);
  const previewAvailability = getPreviewAvailability(previewKind, Boolean(imageSrc || previewText), isOversized);

  return {
    artifact,
    stepId,
    timestamp,
    source,
    imageSrc,
    previewText,
    previewKind,
    rawMetadata: metadata,
    rawMetadataPreviewText: buildRawMetadataPreviewText(metadata, isOversized),
    ...evidenceDisplay,
    ...linkage,
    storageModeLabel: 'Inline pilot evidence',
    storageStatusLabel: 'Object storage deferred',
    ...previewAvailability,
  };
}
