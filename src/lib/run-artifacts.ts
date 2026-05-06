import type { Artifact } from './database.types';

export type RunArtifactPreviewKind = 'image' | 'text' | 'json' | 'binary';

export interface RunArtifactPreview {
  artifact: Artifact;
  stepId: string | null;
  timestamp: string | null;
  source: string | null;
  imageSrc: string | null;
  previewText: string | null;
  previewKind: RunArtifactPreviewKind;
  rawMetadata: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildRunArtifactStepKey(deviceId: string | null, stepId: string | null) {
  return deviceId && stepId ? `${deviceId}::${stepId}` : null;
}

export function normalizeRunArtifact(artifact: Artifact): RunArtifactPreview {
  const metadata = isRecord(artifact.metadata_json) ? artifact.metadata_json : {};
  const stepId = asString(metadata.stepId);
  const base64 = asString(metadata.base64);
  const text = asString(metadata.text);
  const timestamp = asString(metadata.timestamp);
  const source = asString(metadata.source);
  const jsonPayload = isRecord(metadata.json)
    ? metadata.json
    : isRecord(metadata.payload)
      ? metadata.payload
      : null;

  const imageSrc = artifact.type === 'SCREENSHOT' && base64
    ? `data:${artifact.content_type};base64,${base64}`
    : null;

  const previewText = jsonPayload
    ? stringifyJson(jsonPayload)
    : text;

  const previewKind: RunArtifactPreviewKind = imageSrc
    ? 'image'
    : artifact.type === 'JSON_RESULT' && previewText
      ? 'json'
      : previewText
        ? 'text'
        : 'binary';

  return {
    artifact,
    stepId,
    timestamp,
    source,
    imageSrc,
    previewText,
    previewKind,
    rawMetadata: metadata,
  };
}
