import { logAudit } from './audit';
import type { PilotReadinessBackend, PilotReadinessReport, PilotReadinessStatus, Profile, UserRole } from './database.types';
import {
  buildReadinessWarningGates,
  buildVerificationGateResults,
  createReadinessGate,
  getBlockingGates,
  type ReadinessGateResult,
} from './readiness-gates';
import { canCreateReadinessReports, canReviewReadinessReports } from './role-access';
import { supabase } from './supabase';
import { isMissingSchemaError } from './supabase-errors';

export type ReadinessReportInput = {
  backend: PilotReadinessBackend;
  report_path?: string | null;
  evidence_json: Record<string, unknown>;
};

export type ReadinessReviewDecision = Exclude<PilotReadinessStatus, 'draft' | 'submitted'>;

export type EvidenceValidation = {
  valid: boolean;
  issues: string[];
  gates: ReadinessGateResult[];
};

type CurrentProfile = Pick<Profile, 'user_id' | 'role'>;
type EvidenceKeyGroup = {
  key: string;
  label: string;
  aliases: string[];
};

const SECRET_KEY_PATTERNS = [
  /secret/i,
  /token/i,
  /password/i,
  /service[_-]?role/i,
  /api[_-]?key/i,
  /account[_-]?password[_-]?key/i,
];
const ALLOWED_SECRET_STATUS_KEYS = new Set(['secret_scrub_status', 'secretScrubStatus']);

const VALID_BACKENDS = new Set<PilotReadinessBackend>(['mobile_mcp', 'laixi', 'ios_portal', 'unknown']);
const REVIEW_DECISIONS = new Set<ReadinessReviewDecision>(['pilot_verified', 'not_verified', 'needs_rerun']);
const LEVEL_1_EVIDENCE: EvidenceKeyGroup[] = [
  { key: 'pilot_level', label: 'Pilot level', aliases: ['pilotLevel'] },
  { key: 'backend_mode', label: 'Backend mode', aliases: ['backendMode', 'deviceBackend'] },
  { key: 'bridge_health', label: 'Bridge health', aliases: ['bridgeHealth', 'runtimeStatus'] },
  { key: 'worker_health', label: 'Worker health', aliases: ['workerHealth'] },
  { key: 'supabase_health', label: 'Supabase health', aliases: ['supabaseHealth', 'reportStatus'] },
  { key: 'expected_serials', label: 'Expected serials', aliases: ['expectedSerials', 'deviceSerial'] },
  { key: 'observed_serials', label: 'Observed serials', aliases: ['observedSerials', 'sessionId'] },
  { key: 'run_id', label: 'Run id', aliases: ['runId'] },
  { key: 'run_status', label: 'Run status', aliases: ['runStatus', 'smokeResult'] },
  { key: 'artifact_refs', label: 'Artifact refs', aliases: ['artifactRefs', 'artifactEvidence'] },
  { key: 'secret_scrub_status', label: 'Secret scrub status', aliases: ['secretScrubStatus'] },
  { key: 'claim_summary', label: 'Claim summary', aliases: ['claimSummary'] },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

function containsSecretKey(key: string) {
  if (ALLOWED_SECRET_STATUS_KEYS.has(key)) return false;
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function hasBlockedRedaction(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasBlockedRedaction);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nestedValue]) => (
    (key === 'redaction_status' || key === 'redactionStatus') && nestedValue === 'blocked'
  ) || containsSecretKey(key) || hasBlockedRedaction(nestedValue));
}

function getEvidenceValue(evidence: Record<string, unknown>, group: EvidenceKeyGroup) {
  for (const key of [group.key, ...group.aliases]) {
    const value = evidence[key];
    if (Array.isArray(value) ? value.length > 0 : hasValue(value)) return value;
  }
  return undefined;
}

function getEvidenceValueByKey(evidence: Record<string, unknown>, key: string) {
  const group = LEVEL_1_EVIDENCE.find((item) => item.key === key);
  if (group) return getEvidenceValue(evidence, group);
  return evidence[key];
}

export function getLevel1ReadinessEvidenceChecklist(evidence: Record<string, unknown> = {}) {
  return LEVEL_1_EVIDENCE.map((group) => ({
    key: group.key,
    label: group.label,
    present: Array.isArray(getEvidenceValue(evidence, group))
      ? (getEvidenceValue(evidence, group) as unknown[]).length > 0
      : hasValue(getEvidenceValue(evidence, group)),
  }));
}

export function sanitizeReadinessEvidence(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (containsSecretKey(key)) continue;

    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => (
        isRecord(item) ? sanitizeReadinessEvidence(item) : item
      ));
      continue;
    }

    if (isRecord(value)) {
      sanitized[key] = sanitizeReadinessEvidence(value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function validateReadinessEvidence(args: {
  backend: PilotReadinessBackend;
  evidence: Record<string, unknown>;
  decision: ReadinessReviewDecision;
}): EvidenceValidation {
  if (args.decision !== 'pilot_verified') {
    return {
      valid: true,
      issues: [],
      gates: buildReadinessWarningGates(args.evidence),
    };
  }

  const evidence = args.evidence;
  const checklist = getLevel1ReadinessEvidenceChecklist(evidence);
  const gates = [
    ...buildVerificationGateResults({
      backend: args.backend,
      checklist,
      getEvidenceValue: (key) => getEvidenceValueByKey(evidence, key),
    }),
    createReadinessGate({
      key: 'verification.redaction_passed',
      type: 'verification_blocker',
      status: hasBlockedRedaction(evidence) ? 'failed' : 'passed',
      message: hasBlockedRedaction(evidence)
        ? 'Evidence redaction must pass before pilot verification'
        : 'Evidence redaction passed',
      recoveryHint: 'Remove secret-like evidence fields and only attach artifacts with redaction_status not_needed or scrubbed.',
    }),
    ...buildReadinessWarningGates(evidence),
  ];
  const issues = getBlockingGates(gates).map((gate) => gate.message);

  return { valid: issues.length === 0, issues, gates };
}

export function getReadinessReportGates(report: Pick<PilotReadinessReport, 'backend' | 'evidence_json'>): ReadinessGateResult[] {
  return validateReadinessEvidence({
    backend: report.backend,
    evidence: report.evidence_json,
    decision: 'pilot_verified',
  }).gates;
}

async function getCurrentProfile(): Promise<CurrentProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role')
    .maybeSingle();

  if (error) throw new Error(`Failed to get profile: ${error.message}`);
  if (!data) throw new Error('User profile not found');
  return { user_id: data.user_id, role: data.role as UserRole };
}

function normalizeInput(input: ReadinessReportInput) {
  if (!VALID_BACKENDS.has(input.backend)) {
    throw new Error(`Invalid readiness backend: ${input.backend}`);
  }

  return {
    backend: input.backend,
    report_path: input.report_path?.trim() || null,
    evidence_json: sanitizeReadinessEvidence(input.evidence_json),
  };
}

export async function fetchReadinessReports() {
  const { data, error } = await supabase
    .from('pilot_readiness_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (isMissingSchemaError(error)) return [];
  if (error) throw new Error(`Failed to fetch readiness reports: ${error.message}`);
  return data as PilotReadinessReport[];
}

export async function createReadinessReport(input: ReadinessReportInput) {
  const actor = await getCurrentProfile();
  if (!canCreateReadinessReports(actor.role)) {
    throw new Error('Only operators and admins can submit readiness reports');
  }

  const normalized = normalizeInput(input);
  const { data, error } = await supabase
    .from('pilot_readiness_reports')
    .insert({
      ...normalized,
      created_by_user_id: actor.user_id,
      status: 'submitted',
    })
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to submit readiness report: ${error.message}`);
  if (!data) throw new Error('Readiness report not created');

  await logAudit('readiness_report.submit', 'pilot_readiness_report', data.id, {
    backend: normalized.backend,
    actorUserId: actor.user_id,
  });

  return data as PilotReadinessReport;
}

export async function reviewReadinessReport(id: string, decision: ReadinessReviewDecision, reviewNotes = '') {
  const actor = await getCurrentProfile();
  if (!canReviewReadinessReports(actor.role)) {
    throw new Error('Only admins can review readiness reports');
  }
  if (!REVIEW_DECISIONS.has(decision)) {
    throw new Error(`Invalid readiness review decision: ${decision}`);
  }

  const { data: existing, error: fetchError } = await supabase
    .from('pilot_readiness_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw new Error(`Failed to fetch readiness report: ${fetchError.message}`);
  if (!existing) throw new Error('Readiness report not found');

  const report = existing as PilotReadinessReport;
  const validation = validateReadinessEvidence({
    backend: report.backend,
    evidence: report.evidence_json,
    decision,
  });

  if (!validation.valid) {
    throw new Error(`Readiness report cannot be verified: ${validation.issues.join('; ')}`);
  }

  const { data, error } = await supabase
    .from('pilot_readiness_reports')
    .update({
      status: decision,
      reviewed_by_user_id: actor.user_id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to review readiness report: ${error.message}`);
  if (!data) throw new Error('Readiness report review returned no report');

  await logAudit('readiness_report.review', 'pilot_readiness_report', id, {
    actorUserId: actor.user_id,
    decision,
  });

  return data as PilotReadinessReport;
}
