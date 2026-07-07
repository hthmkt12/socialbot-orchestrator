import { logAudit } from './audit';
import type { PilotReadinessBackend, PilotReadinessReport, PilotReadinessStatus, Profile, UserRole } from './database.types';
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
};

type CurrentProfile = Pick<Profile, 'user_id' | 'role'>;

const SECRET_KEY_PATTERNS = [
  /secret/i,
  /token/i,
  /password/i,
  /service[_-]?role/i,
  /api[_-]?key/i,
  /account[_-]?password[_-]?key/i,
];

const VALID_BACKENDS = new Set<PilotReadinessBackend>(['mobile_mcp', 'laixi', 'ios_portal', 'unknown']);
const REVIEW_DECISIONS = new Set<ReadinessReviewDecision>(['pilot_verified', 'not_verified', 'needs_rerun']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

function containsSecretKey(key: string) {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
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
  if (args.decision !== 'pilot_verified') return { valid: true, issues: [] };

  const issues: string[] = [];
  const evidence = args.evidence;

  if (args.backend === 'unknown') issues.push('Backend must be selected before pilot verification');
  if (!hasValue(evidence.runtimeStatus) && !hasValue(evidence.reportStatus)) {
    issues.push('Runtime health or report status evidence is required');
  }
  if (!hasValue(evidence.deviceSerial) && !hasValue(evidence.sessionId)) {
    issues.push('Device serial or session id evidence is required');
  }
  if (!hasValue(evidence.runId) && !hasValue(evidence.smokeResult)) {
    issues.push('Completed run id or smoke result evidence is required');
  }
  if (args.backend === 'laixi' && !hasValue(evidence.laixiLiveSessionProof)) {
    issues.push('Laixi live session proof is required before verifying Laixi readiness');
  }
  if (args.backend === 'ios_portal' && !hasValue(evidence.iosPortalProof)) {
    issues.push('iOS Portal + iproxy proof is required before verifying iOS readiness');
  }

  return { valid: issues.length === 0, issues };
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
