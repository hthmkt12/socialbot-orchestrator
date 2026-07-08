import { describe, expect, it } from 'vitest';
import {
  compactReadinessEvidence,
  createInitialReadinessEvidence,
  readinessEvidenceFieldMeta,
  readinessEvidenceFieldKeys,
} from './readiness-report-form-helpers';

describe('readiness report form helpers', () => {
  it('creates fresh default evidence for the selected backend', () => {
    const evidence = createInitialReadinessEvidence('laixi', new Date('2026-07-08T07:00:00.000Z'));

    expect(evidence).toMatchObject({
      pilot_level: 'level_1',
      backend_mode: 'laixi',
      secret_scrub_status: 'passed',
      verified_at: '2026-07-08T07:00:00.000Z',
    });
  });

  it('keeps field order stable for the readiness form', () => {
    expect(readinessEvidenceFieldKeys).toEqual([
      'pilot_level',
      'backend_mode',
      'runtimeStatus',
      'worker_health',
      'reportStatus',
      'deviceSerial',
      'sessionId',
      'runId',
      'smokeResult',
      'artifact_refs',
      'secret_scrub_status',
      'verified_at',
      'claim_summary',
      'laixiLiveSessionProof',
      'iosPortalProof',
    ]);
  });

  it('has display metadata for every form field', () => {
    for (const key of readinessEvidenceFieldKeys) {
      expect(readinessEvidenceFieldMeta[key].label).not.toHaveLength(0);
      expect(readinessEvidenceFieldMeta[key].placeholder).not.toHaveLength(0);
    }
  });

  it('compacts evidence and converts comma-separated fields into arrays', () => {
    const evidence = {
      ...createInitialReadinessEvidence('mobile_mcp', new Date('2026-07-08T07:00:00.000Z')),
      runtimeStatus: 'ok',
      worker_health: 'ok',
      reportStatus: 'ok',
      deviceSerial: 'device-1, device-2,',
      sessionId: 'device-1',
      runId: 'run-1',
      smokeResult: 'COMPLETED',
      artifact_refs: 'artifact-1, artifact-2',
      claim_summary: 'Level 1 proof',
    };

    expect(compactReadinessEvidence(evidence)).toMatchObject({
      runtimeStatus: 'ok',
      worker_health: 'ok',
      expected_serials: ['device-1', 'device-2'],
      observed_serials: ['device-1'],
      artifact_refs: ['artifact-1', 'artifact-2'],
      verified_at: '2026-07-08T07:00:00.000Z',
    });
  });
});
