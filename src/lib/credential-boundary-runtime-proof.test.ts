import { describe, expect, it } from 'vitest';
// @ts-expect-error The Node-executed runtime adapter is intentionally plain ESM.
import { validateProofManifest } from '../../scripts/credential-boundary-runtime-proof.mjs';

const cleanSurfaces = Object.fromEntries(
  ['database', 'artifactMetadata', 'artifactObjects', 'workerLogs', 'bridgeLogs', 'reports']
    .map((name) => [name, { scanned: true, clean: true, count: 0 }])
);

describe('credential boundary runtime proof manifest', () => {
  it('accepts only complete safe evidence', () => {
    expect(validateProofManifest({
      authMatrix: [{ name: 'missing worker token', status: 'pass' }],
      loginRun: { completed: true, id: 'run-123' },
      persistenceScan: { surfaces: cleanSurfaces },
      cleanup: { verified: true, accountId: 'account-123' },
    })).toMatchObject({
      ok: true,
      authMatrixPassed: true,
      loginRunCompleted: true,
      persistenceScanClean: true,
      cleanupVerified: true,
    });
  });

  it('rejects a proof that omits an in-scope persistence surface', () => {
    const incompleteSurfaces = { ...cleanSurfaces };
    delete incompleteSurfaces.reports;
    expect(validateProofManifest({
      authMatrix: [{ name: 'missing worker token', status: 'pass' }],
      loginRun: { completed: true, id: 'run-123' },
      persistenceScan: { surfaces: incompleteSurfaces },
      cleanup: { verified: true, accountId: 'account-123' },
    }).ok).toBe(false);
  });
});
