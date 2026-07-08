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

export const readinessEvidenceFieldMeta: Record<keyof ReadinessEvidenceForm, { label: string; placeholder: string }> = {
  pilot_level: { label: 'Pilot level', placeholder: 'level_1' },
  backend_mode: { label: 'Backend mode', placeholder: 'mobile_mcp' },
  runtimeStatus: { label: 'Bridge health', placeholder: 'ok' },
  worker_health: { label: 'Worker health', placeholder: 'ok' },
  reportStatus: { label: 'Supabase health', placeholder: 'ok' },
  deviceSerial: { label: 'Expected serials', placeholder: 'device-1, device-2' },
  sessionId: { label: 'Observed serials', placeholder: 'device-1, device-2' },
  runId: { label: 'Run id', placeholder: 'workflow run id' },
  smokeResult: { label: 'Run status', placeholder: 'COMPLETED' },
  artifact_refs: { label: 'Artifact refs', placeholder: 'artifact-1, artifact-2' },
  secret_scrub_status: { label: 'Secret scrub status', placeholder: 'passed' },
  verified_at: { label: 'Verified at', placeholder: 'ISO timestamp' },
  claim_summary: { label: 'Claim summary', placeholder: 'Level 1 Mobile MCP proof only' },
  laixiLiveSessionProof: { label: 'LAIXI live proof', placeholder: 'required only for LAIXI' },
  iosPortalProof: { label: 'iOS Portal proof', placeholder: 'required only for iOS Portal' },
};

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
