import { describe, expect, it } from 'vitest';
// @ts-expect-error The Node-executed release policy is intentionally plain ESM.
import { computeCredentialBoundaryVerdict } from '../../scripts/credential-boundary-verdict.mjs';

type Input = Parameters<typeof computeCredentialBoundaryVerdict>[0];

const baseInput: Input = {
  lintPassed: true,
  typecheckPassed: true,
  testPassed: true,
  buildPassed: true,
  buildWorkerPassed: true,
  cryptoTestsPassed: true,
  redactionTestsPassed: true,
  canaryScanClean: true,
  edgeFunctionNoPlaintextLogging: true,
  runtimeAttempted: false,
  runtimePrerequisitesReady: false,
  authMatrixPassed: false,
  loginRunCompleted: false,
  persistenceScanClean: false,
  cleanupVerified: false,
  capturedLogsClean: false,
  tempLogsDeleted: false,
};

describe('credential boundary verdict policy', () => {
  it('fails when any static gate fails', () => {
    expect(computeCredentialBoundaryVerdict({ ...baseInput, canaryScanClean: false })).toBe('failed');
  });

  it('reports static_verified when no runtime proof was requested', () => {
    expect(computeCredentialBoundaryVerdict(baseInput)).toBe('static_verified');
  });

  it('blocks a requested runtime proof when prerequisites are unavailable', () => {
    expect(computeCredentialBoundaryVerdict({ ...baseInput, runtimeAttempted: true })).toBe('blocked');
  });

  it('requires the auth matrix, login, persistence scan, and cleanup for full_verified', () => {
    const complete = {
      ...baseInput,
      runtimeAttempted: true,
      runtimePrerequisitesReady: true,
      authMatrixPassed: true,
      loginRunCompleted: true,
      persistenceScanClean: true,
      cleanupVerified: true,
      capturedLogsClean: true,
      tempLogsDeleted: true,
    };
    expect(computeCredentialBoundaryVerdict(complete)).toBe('full_verified');
    expect(computeCredentialBoundaryVerdict({ ...complete, authMatrixPassed: false })).toBe('failed');
    expect(computeCredentialBoundaryVerdict({ ...complete, loginRunCompleted: false })).toBe('failed');
    expect(computeCredentialBoundaryVerdict({ ...complete, persistenceScanClean: false })).toBe('failed');
    expect(computeCredentialBoundaryVerdict({ ...complete, cleanupVerified: false })).toBe('failed');
    expect(computeCredentialBoundaryVerdict({ ...complete, tempLogsDeleted: false })).toBe('failed');
  });
});
