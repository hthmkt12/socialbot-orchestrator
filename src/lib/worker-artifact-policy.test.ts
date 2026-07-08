import { describe, expect, it } from 'vitest';
import { prepareArtifactForStorage } from '../../services/execution-worker/src/worker-run-store';

describe('worker artifact policy', () => {
  it('AD-ERR-006 omits screenshot base64 from artifact DB metadata and prepares object upload', () => {
    const prepared = prepareArtifactForStorage({
      workflow_run_id: 'run-1',
      device_id: 'device-1',
      type: 'SCREENSHOT',
      storage_key: 'screenshots/run-1/device-1/step-1.png',
      content_type: 'image/png',
      size: 12,
      metadata_json: { stepId: 'step-1', base64: 'aW1hZ2U=' },
    });

    expect(prepared.metadata_json).toMatchObject({
      stepId: 'step-1',
      inline_payload_omitted: true,
      artifact_kind: 'screenshot',
      storage_mode: 'object_storage',
      redaction_status: 'not_needed',
    });
    expect(prepared.metadata_json.retention_expires_at).toEqual(expect.any(String));
    expect(prepared.metadata_json.base64).toBeUndefined();
    expect(prepared.uploadBuffer?.toString('utf-8')).toBe('image');
  });

  it('AD-NO-006 removes oversized json payloads even when object upload is not available', () => {
    const prepared = prepareArtifactForStorage({
      workflow_run_id: 'run-1',
      device_id: 'device-1',
      type: 'JSON_RESULT',
      storage_key: 'json/run-1/device-1/step-1.json',
      content_type: 'application/json',
      size: 70_000,
      metadata_json: { stepId: 'step-1', payload: { big: true }, json: { alsoBig: true } },
    });

    expect(prepared.metadata_json.payload).toBeUndefined();
    expect(prepared.metadata_json.json).toBeUndefined();
    expect(prepared.metadata_json.inline_payload_omitted).toBe(true);
    expect(prepared.metadata_json.storage_mode).toBe('omitted');
    expect(prepared.uploadBuffer).toBeNull();
  });

  it('WORK-CAN-005 keeps small log text inline for pilot debugging', () => {
    const prepared = prepareArtifactForStorage({
      workflow_run_id: 'run-1',
      device_id: 'device-1',
      type: 'LOG_BLOB',
      storage_key: 'logs/run-1/device-1/step-1.txt',
      content_type: 'text/plain',
      size: 128,
      metadata_json: { stepId: 'step-1', text: 'short log' },
    });

    expect(prepared.metadata_json.text).toBe('short log');
    expect(prepared.metadata_json.inline_payload_omitted).toBeUndefined();
    expect(prepared.metadata_json.storage_mode).toBe('inline');
    expect(prepared.uploadBuffer).toBeNull();
  });
});
