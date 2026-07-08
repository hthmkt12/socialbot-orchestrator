import type { PilotReadinessBackend } from './database.types';

export type ReadinessEvidenceForm = {
  pilot_level: string;
  backend_mode: string;
  runtimeStatus: string;
  worker_health: string;
  reportStatus: string;
  deviceSerial: string;
  sessionId: string;
  runId: string;
  smokeResult: string;
  artifact_refs: string;
  secret_scrub_status: string;
  verified_at: string;
  claim_summary: string;
  laixiLiveSessionProof: string;
  iosPortalProof: string;
};

export function createInitialReadinessEvidence(
  backend: PilotReadinessBackend,
  now = new Date()
): ReadinessEvidenceForm {
  return {
    pilot_level: 'level_1',
    backend_mode: backend,
    runtimeStatus: '',
    worker_health: '',
    reportStatus: '',
    deviceSerial: '',
    sessionId: '',
    runId: '',
    smokeResult: '',
    artifact_refs: '',
    secret_scrub_status: 'passed',
    verified_at: now.toISOString(),
    claim_summary: '',
    laixiLiveSessionProof: '',
    iosPortalProof: '',
  };
}

export const readinessEvidenceFieldKeys = Object.keys(
  createInitialReadinessEvidence('mobile_mcp')
) as Array<keyof ReadinessEvidenceForm>;

export function compactReadinessEvidence(evidence: ReadinessEvidenceForm) {
  const compacted = Object.fromEntries(
    Object.entries(evidence).filter(([, value]) => value.trim().length > 0)
  );

  return {
    ...compacted,
    expected_serials: evidence.deviceSerial.split(',').map((serial) => serial.trim()).filter(Boolean),
    observed_serials: evidence.sessionId.split(',').map((serial) => serial.trim()).filter(Boolean),
    artifact_refs: evidence.artifact_refs.split(',').map((artifact) => artifact.trim()).filter(Boolean),
  };
}
