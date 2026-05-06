import { describe, expect, it } from 'vitest';
import type { Artifact } from './database.types';
import { normalizeRunArtifact } from './run-artifacts';

function buildArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'artifact-1',
    workflow_run_id: 'run-1',
    device_id: 'device-1',
    type: 'SCREENSHOT',
    storage_key: 'runs/run-1/device-1/step-1.png',
    content_type: 'image/png',
    size: 1024,
    metadata_json: { stepId: 'step-1', base64: 'aW1hZ2U=', timestamp: '2026-05-06T00:00:00.000Z' },
    created_at: '2026-05-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('normalizeRunArtifact', () => {
  it('labels screenshots with inline image preview and pilot storage decision', () => {
    const preview = normalizeRunArtifact(buildArtifact());

    expect(preview.evidenceLabel).toBe('Screenshot');
    expect(preview.evidenceKind).toBe('screenshot');
    expect(preview.previewKind).toBe('image');
    expect(preview.imageSrc).toBe('data:image/png;base64,aW1hZ2U=');
    expect(preview.storageModeLabel).toBe('Inline pilot evidence');
    expect(preview.storageStatusLabel).toBe('Object storage deferred');
    expect(preview.previewAvailable).toBe(true);
  });

  it('labels log blobs with text preview and source metadata', () => {
    const preview = normalizeRunArtifact(buildArtifact({
      type: 'LOG_BLOB',
      content_type: 'text/plain',
      metadata_json: { stepId: 'step-1', text: 'opened settings', source: 'output' },
    }));

    expect(preview.evidenceLabel).toBe('Log');
    expect(preview.evidenceKind).toBe('log');
    expect(preview.previewKind).toBe('text');
    expect(preview.previewText).toBe('opened settings');
    expect(preview.source).toBe('output');
  });

  it('labels json results with formatted json preview', () => {
    const preview = normalizeRunArtifact(buildArtifact({
      type: 'JSON_RESULT',
      content_type: 'application/json',
      metadata_json: { stepId: 'step-1', payload: { ok: true } },
    }));

    expect(preview.evidenceLabel).toBe('JSON result');
    expect(preview.evidenceKind).toBe('json');
    expect(preview.previewKind).toBe('json');
    expect(preview.previewText).toContain('"ok": true');
  });

  it('previews json arrays and primitive payloads', () => {
    const arrayPreview = normalizeRunArtifact(buildArtifact({
      type: 'JSON_RESULT',
      content_type: 'application/json',
      metadata_json: { stepId: 'step-1', payload: ['a', 'b'] },
    }));
    const primitivePreview = normalizeRunArtifact(buildArtifact({
      type: 'JSON_RESULT',
      content_type: 'application/json',
      metadata_json: { stepId: 'step-1', json: true },
    }));

    expect(arrayPreview.previewKind).toBe('json');
    expect(arrayPreview.previewText).toContain('"a"');
    expect(primitivePreview.previewKind).toBe('json');
    expect(primitivePreview.previewText).toBe('true');
  });

  it('reports missing linkage when step or device is absent', () => {
    const missingStep = normalizeRunArtifact(buildArtifact({ metadata_json: { base64: 'aW1hZ2U=' } }));
    const missingDevice = normalizeRunArtifact(buildArtifact({ device_id: null }));
    const missingBoth = normalizeRunArtifact(buildArtifact({ device_id: null, metadata_json: {} }));

    expect(missingStep.linkageStatus).toBe('missing-step');
    expect(missingStep.linkageMessage).toContain('stepId');
    expect(missingDevice.linkageStatus).toBe('missing-device');
    expect(missingDevice.linkageMessage).toContain('device');
    expect(missingBoth.linkageStatus).toBe('missing-device-and-step');
    expect(missingBoth.linkageMessage).toContain('device');
    expect(missingBoth.linkageMessage).toContain('stepId');
  });

  it('reports missing preview payload without hiding raw metadata', () => {
    const preview = normalizeRunArtifact(buildArtifact({
      metadata_json: { stepId: 'step-1', timestamp: '2026-05-06T00:00:00.000Z' },
    }));

    expect(preview.previewAvailable).toBe(false);
    expect(preview.previewAvailabilityLabel).toBe('Inline preview missing');
    expect(preview.previewAvailabilityReason).toContain('payload');
    expect(preview.rawMetadata).toEqual({ stepId: 'step-1', timestamp: '2026-05-06T00:00:00.000Z' });
  });

  it('omits oversized inline previews and masks bulky metadata payloads', () => {
    const preview = normalizeRunArtifact(buildArtifact({
      size: 600_000,
      metadata_json: { stepId: 'step-1', base64: 'aW1hZ2U=' },
    }));

    expect(preview.previewAvailable).toBe(false);
    expect(preview.previewAvailabilityReason).toContain('too large');
    expect(preview.imageSrc).toBeNull();
    expect(preview.rawMetadataPreviewText).toContain('[omitted from inline preview]');
  });

  it('falls back to artifact creation time when metadata timestamp is invalid', () => {
    const preview = normalizeRunArtifact(buildArtifact({
      created_at: '2026-05-06T12:00:00.000Z',
      metadata_json: { stepId: 'step-1', base64: 'aW1hZ2U=', timestamp: 'not-a-date' },
    }));

    expect(preview.timestamp).toBe('2026-05-06T12:00:00.000Z');
  });
});
