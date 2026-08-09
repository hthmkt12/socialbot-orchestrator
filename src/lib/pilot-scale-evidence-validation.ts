export type PilotScaleSequenceValidation = {
  valid: boolean;
  issues: string[];
};

const REQUIRED_RUNS = 3;
const REQUIRED_DEVICES = 5;
const WORKFLOW_KEY = 'instagram_warmup';
const WORKFLOW_VERSION = '1';
const MATERIAL_CONTEXT_KEYS = [
  'backend_mode',
  'auth_mode',
  'supabase_project',
  'workflow_key',
  'workflow_version',
] as const;
const INTEGRITY_FLAGS = [
  'duplicate_execution',
  'duplicate_steps',
  'leaked_locks',
  'stale_ownership',
  'manual_db_repair',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return strings.length === value.length ? strings : [];
}

function hasUniqueValues(values: string[]) {
  return values.length === new Set(values).size;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getMatchingSerials(run: Record<string, unknown>) {
  const expected = asStrings(run.expected_serials);
  const observed = asStrings(run.observed_serials);
  const valid = expected.length === REQUIRED_DEVICES
    && observed.length === REQUIRED_DEVICES
    && hasUniqueValues(expected)
    && hasUniqueValues(observed)
    && expected.every((serial) => observed.includes(serial));

  return valid ? expected : null;
}

function hasFiveMatchingSerials(run: Record<string, unknown>) {
  return getMatchingSerials(run) !== null;
}

function hasStableSerialSet(runs: Record<string, unknown>[]) {
  const first = getMatchingSerials(runs[0]);
  if (!first) return false;

  const expectedSet = new Set(first);
  return runs.every((run) => {
    const serials = getMatchingSerials(run);
    return serials !== null
      && serials.length === expectedSet.size
      && serials.every((serial) => expectedSet.has(serial));
  });
}

function hasTargetArtifacts(run: Record<string, unknown>) {
  const outcomes = Array.isArray(run.per_target_outcomes) ? run.per_target_outcomes : [];
  const artifacts = asStrings(run.artifact_refs);
  const observed = asStrings(run.observed_serials);
  if (outcomes.length !== REQUIRED_DEVICES || artifacts.length < REQUIRED_DEVICES) return false;

  const outcomeSerials = outcomes.map((outcome) => (
    isRecord(outcome) && isNonEmptyString(outcome.serial) ? outcome.serial : ''
  ));
  if (!hasUniqueValues(outcomeSerials) || outcomeSerials.some((serial) => !observed.includes(serial))) return false;

  return outcomes.every((outcome) => {
    if (!isRecord(outcome) || outcome.status !== 'COMPLETED') return false;
    const outcomeArtifacts = asStrings(outcome.artifact_refs);
    return outcomeArtifacts.length > 0 && outcomeArtifacts.every((artifact) => artifacts.includes(artifact));
  });
}

function isMaterialContextValue(key: typeof MATERIAL_CONTEXT_KEYS[number], value: unknown) {
  if (isNonEmptyString(value)) return true;
  return key === 'workflow_version' && typeof value === 'number' && Number.isFinite(value);
}

function sameMaterialContext(runs: Record<string, unknown>[]) {
  const first = runs[0];
  return MATERIAL_CONTEXT_KEYS.every((key) => {
    const value = first[key];
    return isMaterialContextValue(key, value)
      && runs.every((run) => run[key] === value);
  });
}

export function validatePilotScaleSequence(input: unknown): PilotScaleSequenceValidation {
  const issues: string[] = [];
  const runs = Array.isArray(input) ? input : [];

  if (!Array.isArray(input) || runs.length !== REQUIRED_RUNS) {
    issues.push('Sequence must contain exactly three runs');
  }

  if (runs.some((run) => !isRecord(run))) {
    issues.push('Sequence must contain exactly three valid runs');
  }

  if (runs.length !== REQUIRED_RUNS || runs.some((run) => !isRecord(run))) {
    return { valid: false, issues };
  }

  const validRuns = runs as Record<string, unknown>[];

  const runIds = validRuns.map((run) => isNonEmptyString(run.run_id) ? run.run_id : '');
  if (runIds.some((runId) => !runId) || !hasUniqueValues(runIds)) {
    issues.push('Sequence run IDs must be present and unique');
  }

  if (!sameMaterialContext(validRuns)) {
    issues.push('Sequence material context must remain unchanged');
  }

  if (!hasStableSerialSet(validRuns)) {
    issues.push('Sequence must use the same five serials across all runs');
  }

  validRuns.forEach((run, index) => {
    if (run.run_status !== 'COMPLETED') {
      issues.push(`Run ${index + 1} must be COMPLETED`);
    }

    if (run.workflow_key !== WORKFLOW_KEY || String(run.workflow_version) !== WORKFLOW_VERSION) {
      issues.push(`Run ${index + 1} must use instagram_warmup version 1`);
    }

    if (!hasFiveMatchingSerials(run)) {
      issues.push('Each run must contain exactly five unique expected and observed serials');
    }

    if (run.secret_scrub_status !== 'passed') {
      issues.push(`Run ${index + 1} secret scrub must pass`);
    }

    if (!hasTargetArtifacts(run)) {
      issues.push(`Run ${index + 1} must include five completed target outcomes with artifacts`);
    }

    INTEGRITY_FLAGS.forEach((flag) => {
      if (run[flag] !== false) issues.push(`Run ${index + 1} has disallowed ${flag}`);
    });
  });

  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}
