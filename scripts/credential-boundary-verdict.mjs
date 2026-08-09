/**
 * Pure verdict policy for credential-boundary verification.
 *
 * Keeping this separate from the executable verifier makes the release rule
 * testable and prevents a report-only change from silently changing policy.
 */
export function computeCredentialBoundaryVerdict(input) {
  const staticPassed =
    input.lintPassed && input.typecheckPassed && input.testPassed &&
    input.buildPassed && input.buildWorkerPassed &&
    input.cryptoTestsPassed && input.redactionTestsPassed &&
    input.canaryScanClean && input.edgeFunctionNoPlaintextLogging;

  if (!staticPassed) return 'failed';
  if (!input.runtimeAttempted) return 'static_verified';
  if (!input.runtimePrerequisitesReady) return 'blocked';
  if (!input.authMatrixPassed) return 'failed';
  if (
    !input.loginRunCompleted || !input.persistenceScanClean || !input.cleanupVerified ||
    !input.capturedLogsClean || !input.tempLogsDeleted
  ) return 'failed';
  return 'full_verified';
}
