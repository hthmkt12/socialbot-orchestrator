import type { Artifact } from './database.types';

export type RunArtifactPreviewKind = 'image' | 'text' | 'json' | 'binary';
export type RunArtifactEvidenceKind = 'screenshot' | 'log' | 'json' | 'unknown';
export type RunArtifactLinkageStatus = 'linked' | 'missing-device' | 'missing-step' | 'missing-device-and-step';
export type RunArtifactStorageMode = 'inline' | 'object_storage' | 'external_ref' | 'omitted' | 'unknown';

const MAX_INLINE_PREVIEW_BYTES = 64 * 1024;

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
  storageMode: RunArtifactStorageMode;
  retentionExpiresAt: string | null;
  isExpired: boolean;
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

function normalizeStorageMode(value: unknown): RunArtifactStorageMode {
  if (value === 'object' || value === 'object_storage') return 'object_storage';
  if (value === 'inline' || value === 'external_ref' || value === 'omitted') return value;
  return 'unknown';
}

function getStorageDisplay(mode: RunArtifactStorageMode, status: unknown) {
  if (mode === 'object_storage') return { storageModeLabel: 'Object storage', storageStatusLabel: String(status ?? 'stored remotely') };
  if (mode === 'external_ref') return { storageModeLabel: 'External reference', storageStatusLabel: String(status ?? 'referenced') };
  if (mode === 'omitted') return { storageModeLabel: 'Payload omitted', storageStatusLabel: String(status ?? 'metadata only') };
  if (mode === 'inline') return { storageModeLabel: 'Inline pilot evidence', storageStatusLabel: String(status ?? 'inline preview') };
  return { storageModeLabel: 'Unknown storage mode', storageStatusLabel: String(status ?? 'metadata only') };
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
  const storageMode = normalizeStorageMode(metadata.storage_mode);
  const isObjectStorage = storageMode === 'object_storage';
  const retentionExpiresAt = asValidTimestamp(metadata.retention_expires_at);
  const isExpired = retentionExpiresAt ? new Date(retentionExpiresAt).getTime() < Date.now() : false;

  const imageSrc = artifact.type === 'SCREENSHOT' && base64 && !isOversized && !isExpired
    ? `data:${artifact.content_type};base64,${base64}`
    : null;

  const previewText = jsonPayload !== undefined && !isOversized && !isExpired
    ? stringifyJson(jsonPayload)
    : isOversized || isExpired
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
  const previewAvailability = isExpired
    ? {
      previewAvailable: false,
      previewAvailabilityLabel: 'Artifact expired',
      previewAvailabilityReason: 'Artifact retention window has expired; metadata is shown instead.',
    }
    : getPreviewAvailability(previewKind, Boolean(imageSrc || previewText || isObjectStorage), isOversized);
  const storageDisplay = getStorageDisplay(storageMode, metadata.storage_status);

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
    storageMode,
    retentionExpiresAt,
    isExpired,
    ...storageDisplay,
    ...previewAvailability,
  };
}
