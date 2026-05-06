export interface NormalizedRunStepError {
  code: string;
  title: string;
  summary: string;
  detail: string;
  hint?: string;
  timestamp?: string;
  attempt?: number;
  raw: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toSentenceCaseFromCode(code: string) {
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stringifyFallback(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDetail(
  code: string,
  summary: string,
  details: Record<string, unknown> | undefined,
  reviewerNotes: string | undefined
) {
  const timeoutMs = asNumber(details?.timeoutMs);

  switch (code) {
    case 'APPROVAL_REJECTED':
      return reviewerNotes
        ? `A reviewer rejected this step. Reviewer notes: ${reviewerNotes}`
        : 'A reviewer rejected this step before execution could continue.';
    case 'STEP_TIMEOUT':
      return timeoutMs
        ? `The step exceeded its configured timeout of ${Math.round(timeoutMs / 1000)}s.`
        : 'The step exceeded its configured execution timeout.';
    case 'STEP_EXCEPTION':
      return `The step threw an exception before returning a normal result. ${summary}`;
    case 'STEP_FAILED':
      return `The device adapter reported a failure result for this step. ${summary}`;
    case 'DEVICE_LOCKED':
      return 'Another run already owns the device lock for this target, so execution could not start.';
    case 'RUNNER_CRASH':
      return 'The execution worker crashed or lost ownership while this device run was in progress.';
    case 'ERROR':
      return summary;
    default:
      return summary;
  }
}

function buildHint(code: string) {
  switch (code) {
    case 'APPROVAL_REJECTED':
      return 'Review the requested action, update reviewer context if needed, then relaunch after approval.';
    case 'STEP_TIMEOUT':
      return 'Check device/app responsiveness or raise the timeout before retrying.';
    case 'STEP_EXCEPTION':
      return 'Inspect worker logs and the raw payload for the thrown exception path.';
    case 'STEP_FAILED':
      return 'Compare the step inputs, device state, and any artifacts around the failure.';
    case 'DEVICE_LOCKED':
      return 'Wait for the owning run to finish or clear stale locks from the operations tools.';
    case 'RUNNER_CRASH':
      return 'Check worker and gateway health before retrying this run.';
    default:
      return undefined;
  }
}

export function normalizeRunStepError(error: unknown): NormalizedRunStepError | null {
  if (error == null) return null;

  if (!isRecord(error)) {
    const summary = stringifyFallback(error);
    return {
      code: 'UNKNOWN_ERROR',
      title: 'Unknown Step Error',
      summary,
      detail: summary,
      raw: error,
    };
  }

  const code = asString(error.code) ?? 'UNKNOWN_ERROR';
  const summary = asString(error.message) ?? stringifyFallback(error);
  const details = isRecord(error.details) ? error.details : undefined;
  const reviewerNotes = asString(error.reviewerNotes);
  const title = ({
    APPROVAL_REJECTED: 'Approval Rejected',
    STEP_TIMEOUT: 'Step Timed Out',
    STEP_EXCEPTION: 'Step Threw An Exception',
    STEP_FAILED: 'Step Reported A Failure',
    DEVICE_LOCKED: 'Device Locked By Another Run',
    RUNNER_CRASH: 'Execution Worker Crashed',
    ERROR: 'Step Error',
  } as Record<string, string>)[code] ?? toSentenceCaseFromCode(code);

  return {
    code,
    title,
    summary,
    detail: buildDetail(code, summary, details, reviewerNotes),
    hint: buildHint(code),
    timestamp: asString(error.timestamp),
    attempt: asNumber(error.attempt),
    raw: error,
  };
}
