import type { PilotReadinessBackend } from './database.types';
import type { RunPreflightIssue } from './run-preflight-types';

export type ReadinessGateType = 'launch_blocker' | 'verification_blocker' | 'warning';
export type ReadinessGateStatus = 'passed' | 'failed' | 'skipped';

export interface ReadinessGateResult {
  key: string;
  type: ReadinessGateType;
  status: ReadinessGateStatus;
  message: string;
  recoveryHint: string;
}

export type EvidenceChecklistItem = {
  key: string;
  label: string;
  present: boolean;
};

const DEFAULT_LAUNCH_RECOVERY_HINT = 'Resolve this preflight issue before dispatching the run.';

export function createReadinessGate(args: ReadinessGateResult): ReadinessGateResult {
  return args;
}

export function isGateBlocking(gate: ReadinessGateResult): boolean {
  return gate.status === 'failed' && gate.type !== 'warning';
}

export function getBlockingGates(gates: ReadinessGateResult[]): ReadinessGateResult[] {
  return gates.filter(isGateBlocking);
}

export function mapPreflightIssuesToGates(issues: RunPreflightIssue[]): ReadinessGateResult[] {
  return issues.map((issue) => createReadinessGate({
    key: `${issue.severity === 'blocking' ? 'launch' : 'warning'}.${issue.id}`,
    type: issue.severity === 'blocking' ? 'launch_blocker' : 'warning',
    status: 'failed',
    message: issue.title,
    recoveryHint: issue.recoveryHint ?? issue.detail ?? DEFAULT_LAUNCH_RECOVERY_HINT,
  }));
}

export function buildLaunchGateResults(args: {
  blockingIssues: RunPreflightIssue[];
  warnings: RunPreflightIssue[];
}): ReadinessGateResult[] {
  const failed = mapPreflightIssuesToGates([
    ...args.blockingIssues,
    ...args.warnings,
  ]);

  if (args.blockingIssues.length === 0) {
    failed.unshift(createReadinessGate({
      key: 'launch.dispatch_preflight',
      type: 'launch_blocker',
      status: 'passed',
      message: 'Dispatch preflight passed',
      recoveryHint: 'No launch blocker is currently active.',
    }));
  }

  return failed;
}

export function buildVerificationGateResults(args: {
  backend: PilotReadinessBackend;
  checklist: EvidenceChecklistItem[];
  getEvidenceValue: (key: string) => unknown;
}): ReadinessGateResult[] {
  const gates: ReadinessGateResult[] = [];

  gates.push(createReadinessGate({
    key: 'verification.backend_selected',
    type: 'verification_blocker',
    status: args.backend === 'unknown' ? 'failed' : 'passed',
    message: args.backend === 'unknown'
      ? 'Backend must be selected before pilot verification'
      : 'Backend is selected',
    recoveryHint: 'Choose Mobile MCP, LAIXI, or iOS Portal before marking the report pilot verified.',
  }));

  for (const item of args.checklist) {
    gates.push(createReadinessGate({
      key: `verification.level1.${item.key}`,
      type: 'verification_blocker',
      status: item.present ? 'passed' : 'failed',
      message: item.present ? `${item.label} evidence is present` : `${item.label} evidence is required`,
      recoveryHint: `Attach ${item.label.toLowerCase()} evidence before pilot verification.`,
    }));
  }

  const secretScrubPassed = args.getEvidenceValue('secret_scrub_status') === 'passed';
  gates.push(createReadinessGate({
    key: 'verification.secret_scrub_passed',
    type: 'verification_blocker',
    status: secretScrubPassed ? 'passed' : 'failed',
    message: secretScrubPassed
      ? 'Secret scrub status passed'
      : 'Secret scrub status must be passed before pilot verification',
    recoveryHint: 'Run the evidence scrubber and submit a report with secret_scrub_status set to passed.',
  }));

  if (args.backend === 'laixi') {
    const passed = hasValue(args.getEvidenceValue('laixiLiveSessionProof'));
    gates.push(createReadinessGate({
      key: 'verification.laixi_live_proof',
      type: 'verification_blocker',
      status: passed ? 'passed' : 'failed',
      message: passed
        ? 'Laixi live session proof is present'
        : 'Laixi live session proof is required before verifying Laixi readiness',
      recoveryHint: 'Attach live LAIXI session evidence from the pilot run.',
    }));
  }

  if (args.backend === 'ios_portal') {
    const passed = hasValue(args.getEvidenceValue('iosPortalProof'));
    gates.push(createReadinessGate({
      key: 'verification.ios_portal_proof',
      type: 'verification_blocker',
      status: passed ? 'passed' : 'failed',
      message: passed
        ? 'iOS Portal proof is present'
        : 'iOS Portal + iproxy proof is required before verifying iOS readiness',
      recoveryHint: 'Attach iOS Portal and iproxy proof from the pilot run.',
    }));
  }

  return gates;
}

export function buildReadinessWarningGates(evidence: Record<string, unknown>): ReadinessGateResult[] {
  const gates: ReadinessGateResult[] = [];
  const analyticsSource = String(evidence.analytics_source ?? evidence.analyticsSource ?? '').toLowerCase();
  if (analyticsSource === 'seed data' || analyticsSource === 'insufficient data') {
    gates.push(createReadinessGate({
      key: 'warning.analytics_insufficient_data',
      type: 'warning',
      status: 'failed',
      message: 'Analytics evidence is not production-grade yet',
      recoveryHint: 'Collect live analytics evidence before using this report for broader scale decisions.',
    }));
  }

  const artifactPreviewFallback = evidence.artifact_preview_fallback ?? evidence.artifactPreviewFallback;
  if (artifactPreviewFallback === true || artifactPreviewFallback === 'true') {
    gates.push(createReadinessGate({
      key: 'warning.artifact_preview_fallback',
      type: 'warning',
      status: 'failed',
      message: 'Artifact preview used fallback rendering',
      recoveryHint: 'Verify the original artifact directly if preview rendering is degraded.',
    }));
  }

  if (gates.length === 0) {
    gates.push(createReadinessGate({
      key: 'warning.readiness_context',
      type: 'warning',
      status: 'passed',
      message: 'No readiness warnings detected',
      recoveryHint: 'Continue reviewing blocker gates before scaling.',
    }));
  }

  return gates;
}

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}
