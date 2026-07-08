import { describe, expect, it } from 'vitest';
import {
  buildLaunchGateResults,
  buildReadinessWarningGates,
  buildVerificationGateResults,
  getBlockingGates,
} from './readiness-gates';

describe('readiness gates', () => {
  it('fails launch blocker gates when preflight has blocking issues', () => {
    const gates = buildLaunchGateResults({
      blockingIssues: [{
        id: 'viewer-role-block',
        severity: 'blocking',
        title: 'Viewer role cannot launch runs',
        detail: 'Ask an operator or admin to launch this workflow.',
      }],
      warnings: [],
    });

    expect(gates).toEqual([
      expect.objectContaining({
        key: 'launch.viewer-role-block',
        type: 'launch_blocker',
        status: 'failed',
      }),
    ]);
    expect(getBlockingGates(gates)).toHaveLength(1);
  });

  it('passes launch blocker gate when dispatch preflight has no blockers', () => {
    const gates = buildLaunchGateResults({ blockingIssues: [], warnings: [] });

    expect(gates).toEqual([
      expect.objectContaining({
        key: 'launch.dispatch_preflight',
        type: 'launch_blocker',
        status: 'passed',
      }),
    ]);
    expect(getBlockingGates(gates)).toHaveLength(0);
  });

  it('fails verification blocker gates when required evidence is missing', () => {
    const gates = buildVerificationGateResults({
      backend: 'unknown',
      checklist: [{ key: 'run_id', label: 'Run id', present: false }],
      getEvidenceValue: () => undefined,
    });

    expect(gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'verification.backend_selected', type: 'verification_blocker', status: 'failed' }),
      expect.objectContaining({ key: 'verification.level1.run_id', type: 'verification_blocker', status: 'failed' }),
      expect.objectContaining({ key: 'verification.secret_scrub_passed', type: 'verification_blocker', status: 'failed' }),
    ]));
    expect(getBlockingGates(gates)).toHaveLength(3);
  });

  it('passes verification blocker gates when evidence is complete', () => {
    const gates = buildVerificationGateResults({
      backend: 'mobile_mcp',
      checklist: [{ key: 'run_id', label: 'Run id', present: true }],
      getEvidenceValue: (key) => key === 'secret_scrub_status' ? 'passed' : 'value',
    });

    expect(gates.every((gate) => gate.status === 'passed')).toBe(true);
    expect(getBlockingGates(gates)).toHaveLength(0);
  });

  it('surfaces failed warnings without blocking verification or launch', () => {
    const gates = buildReadinessWarningGates({
      analytics_source: 'insufficient data',
      artifact_preview_fallback: true,
    });

    expect(gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'warning.analytics_insufficient_data', type: 'warning', status: 'failed' }),
      expect.objectContaining({ key: 'warning.artifact_preview_fallback', type: 'warning', status: 'failed' }),
    ]));
    expect(getBlockingGates(gates)).toHaveLength(0);
  });
});
