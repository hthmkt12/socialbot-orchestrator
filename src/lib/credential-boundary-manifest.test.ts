import { describe, expect, it } from 'vitest';
// @ts-expect-error Plain ESM module executed by Node.
import { validateProofManifest } from '../../scripts/credential-boundary-runtime-proof.mjs';

const validManifest = {
  blocked: false,
  authMatrix: [
    { name: 'missing_bearer', status: 'pass' },
    { name: 'wrong_bearer', status: 'pass' },
    { name: 'valid_bound_decrypt', status: 'pass' },
  ],
  loginRun: { completed: true, id: 'run-abc-123' },
  persistenceScan: {
    surfaces: {
      database: { scanned: true, clean: true, count: 5 },
      artifactMetadata: { scanned: true, clean: true, count: 2 },
      artifactObjects: { scanned: true, clean: true, count: 1 },
      workerLogs: { scanned: true, clean: true, count: 0 },
      bridgeLogs: { scanned: true, clean: true, count: 0 },
      reports: { scanned: true, clean: true, count: 0 },
    },
  },
  cleanup: { verified: true, accountId: 'acct-123', runId: 'run-abc-123' },
};

describe('validateProofManifest', () => {
  it('accepts a fully valid manifest', () => {
    const result = validateProofManifest(validManifest);
    expect(result.ok).toBe(true);
    expect(result.authMatrixPassed).toBe(true);
    expect(result.loginRunCompleted).toBe(true);
    expect(result.persistenceScanClean).toBe(true);
    expect(result.cleanupVerified).toBe(true);
    expect(result.safeEvidence.authCaseCount).toBe(3);
    expect(result.safeEvidence.loginRunId).toBe('run-abc-123');
  });

  it('rejects null or non-object input', () => {
    expect(validateProofManifest(null).ok).toBe(false);
    expect(validateProofManifest(undefined).ok).toBe(false);
    expect(validateProofManifest('string').ok).toBe(false);
    expect(validateProofManifest(42).ok).toBe(false);
  });

  it('fails when authMatrix is missing or empty', () => {
    expect(validateProofManifest({ ...validManifest, authMatrix: [] }).ok).toBe(false);
    expect(validateProofManifest({ ...validManifest, authMatrix: undefined }).ok).toBe(false);
  });

  it('fails when any auth matrix case has status !== pass', () => {
    const result = validateProofManifest({
      ...validManifest,
      authMatrix: [
        { name: 'missing_bearer', status: 'pass' },
        { name: 'wrong_bearer', status: 'fail' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.authMatrixPassed).toBe(false);
  });

  it('fails when authMatrix items lack status field', () => {
    const result = validateProofManifest({
      ...validManifest,
      authMatrix: [{ name: 'case1' }],
    });
    expect(result.ok).toBe(false);
    expect(result.authMatrixPassed).toBe(false);
  });

  it('fails when any required surface is missing', () => {
    const surfaces: Record<string, unknown> = { ...validManifest.persistenceScan.surfaces };
    delete surfaces.database;
    const result = validateProofManifest({
      ...validManifest,
      persistenceScan: { surfaces },
    });
    expect(result.ok).toBe(false);
    expect(result.persistenceScanClean).toBe(false);
  });

  it('fails when a surface was scanned but is not clean', () => {
    const result = validateProofManifest({
      ...validManifest,
      persistenceScan: {
        surfaces: {
          ...validManifest.persistenceScan.surfaces,
          database: { scanned: true, clean: false, count: 5 },
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.persistenceScanClean).toBe(false);
  });

  it('fails when a surface was not scanned', () => {
    const result = validateProofManifest({
      ...validManifest,
      persistenceScan: {
        surfaces: {
          ...validManifest.persistenceScan.surfaces,
          artifactObjects: { scanned: false, clean: true, count: 0 },
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.persistenceScanClean).toBe(false);
  });

  it('fails when loginRun is not completed', () => {
    expect(validateProofManifest({ ...validManifest, loginRun: { completed: false } }).ok).toBe(false);
    expect(validateProofManifest({ ...validManifest, loginRun: { completed: true } }).ok).toBe(false);
    expect(validateProofManifest({ ...validManifest, loginRun: undefined }).ok).toBe(false);
  });

  it('fails when cleanup is not verified', () => {
    expect(validateProofManifest({ ...validManifest, cleanup: { verified: false } }).ok).toBe(false);
    expect(validateProofManifest({ ...validManifest, cleanup: undefined }).ok).toBe(false);
  });

  it('treats a blocked manifest as invalid', () => {
    const blockedManifest = {
      blocked: true,
      reason: 'SUPABASE_URL is required',
      authMatrix: [],
      loginRun: { completed: false },
      persistenceScan: { surfaces: {} },
      cleanup: { verified: false },
    };
    const result = validateProofManifest(blockedManifest);
    expect(result.ok).toBe(false);
    expect(result.authMatrixPassed).toBe(false);
  });

  it('sanitizes auth case names and statuses in safeEvidence', () => {
    const result = validateProofManifest({
      ...validManifest,
      authMatrix: [
        { name: 'case_a', status: 'pass' },
        { name: 'case_b', status: 'fail' },
        { status: 'pass' },
      ],
    });
    expect(result.safeEvidence.authCases).toEqual([
      { name: 'case_a', status: 'pass' },
      { name: 'case_b', status: 'fail' },
      { name: 'unknown', status: 'pass' },
    ]);
  });

  it('returns null loginRunId when login is not completed', () => {
    const result = validateProofManifest({
      ...validManifest,
      loginRun: { completed: false, id: 'some-id' },
    });
    expect(result.safeEvidence.loginRunId).toBeNull();
  });

  it('returns null cleanupAccountId when cleanup is not verified', () => {
    const result = validateProofManifest({
      ...validManifest,
      cleanup: { verified: false, accountId: 'some-acct' },
    });
    expect(result.safeEvidence.cleanupAccountId).toBeNull();
  });

  it('includes scan counts for all required surfaces', () => {
    const result = validateProofManifest(validManifest);
    expect(result.safeEvidence.scanCounts).toEqual({
      database: 5,
      artifactMetadata: 2,
      artifactObjects: 1,
      workerLogs: 0,
      bridgeLogs: 0,
      reports: 0,
    });
  });
});
