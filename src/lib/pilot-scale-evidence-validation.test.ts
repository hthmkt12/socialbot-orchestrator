import { describe, expect, it } from 'vitest';
import { validatePilotScaleSequence } from './pilot-scale-evidence-validation';

const serials = ['device-1', 'device-2', 'device-3', 'device-4', 'device-5'];

function acceptedRun(index: number, overrides: Record<string, unknown> = {}) {
  return {
    run_id: `run-${index}`,
    run_status: 'COMPLETED',
    backend_mode: 'mobile_mcp',
    auth_mode: 'operator_session',
    supabase_project: 'pilot-project',
    workflow_key: 'instagram_warmup',
    workflow_version: 1,
    expected_serials: serials,
    observed_serials: serials,
    per_target_outcomes: serials.map((serial) => ({
      serial,
      status: 'COMPLETED',
      artifact_refs: [`artifact-${index}-${serial}`],
    })),
    artifact_refs: serials.map((serial) => `artifact-${index}-${serial}`),
    secret_scrub_status: 'passed',
    duplicate_execution: false,
    duplicate_steps: false,
    leaked_locks: false,
    stale_ownership: false,
    manual_db_repair: false,
    ...overrides,
  };
}

describe('pilot scale evidence validation', () => {
  it('accepts three consecutive completed five-device runs', () => {
    expect(validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3),
    ])).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['wrong run count', [acceptedRun(1), acceptedRun(2)]],
    ['duplicate run id', [acceptedRun(1), acceptedRun(1), acceptedRun(3)]],
    ['failed status', [acceptedRun(1), acceptedRun(2), acceptedRun(3, { run_status: 'FAILED' })]],
    ['changed workflow version', [acceptedRun(1), acceptedRun(2), acceptedRun(3, { workflow_version: 2 })]],
    ['partial target outcome', [acceptedRun(1), acceptedRun(2), acceptedRun(3, {
      per_target_outcomes: serials.map((serial, index) => ({
        serial,
        status: index === 0 ? 'FAILED' : 'COMPLETED',
        artifact_refs: [`artifact-3-${serial}`],
      })),
    })]],
    ['missing artifact', [acceptedRun(1), acceptedRun(2), acceptedRun(3, { artifact_refs: [] })]],
    ['secret scrub failure', [acceptedRun(1), acceptedRun(2), acceptedRun(3, { secret_scrub_status: 'blocked' })]],
    ['duplicate execution', [acceptedRun(1), acceptedRun(2), acceptedRun(3, { duplicate_execution: true })]],
    ['duplicate steps', [acceptedRun(1), acceptedRun(2), acceptedRun(3, { duplicate_steps: true })]],
    ['unlinked target artifact', [acceptedRun(1), acceptedRun(2), acceptedRun(3, {
      per_target_outcomes: serials.map((serial) => ({ serial, status: 'COMPLETED', artifact_refs: ['missing-artifact'] })),
    })]],
  ])('rejects %s', (_label, runs) => {
    const result = validatePilotScaleSequence(runs);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('requires exactly five unique observed serials matching expected serials', () => {
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3, {
        expected_serials: [...serials, 'device-6'],
        observed_serials: ['device-1', 'device-2', 'device-3', 'device-4', 'device-4', 'device-6'],
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Each run must contain exactly five unique expected and observed serials');
  });

  it('requires the same five serials across every run', () => {
    const alternateSerials = ['device-1', 'device-2', 'device-3', 'device-4', 'device-6'];
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3, {
        expected_serials: alternateSerials,
        observed_serials: alternateSerials,
        per_target_outcomes: alternateSerials.map((serial) => ({
          serial,
          status: 'COMPLETED',
          artifact_refs: [`artifact-3-${serial}`],
        })),
        artifact_refs: alternateSerials.map((serial) => `artifact-3-${serial}`),
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Sequence must use the same five serials across all runs');
  });

  it('rejects lowercase terminal statuses', () => {
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3, { run_status: 'completed' }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Run 3 must be COMPLETED');
  });

  it('rejects malformed entries instead of filtering them from the sequence', () => {
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      null,
      acceptedRun(3),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Sequence must contain exactly three valid runs');
  });

  it('rejects runs with missing material context even when all runs agree', () => {
    const result = validatePilotScaleSequence([1, 2, 3].map((index) => acceptedRun(index, {
      backend_mode: null,
      auth_mode: null,
      supabase_project: null,
      workflow_key: null,
      workflow_version: null,
    })));

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Sequence material context must remain unchanged');
  });

  it('rejects non-string serial and artifact identifiers', () => {
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3, {
        expected_serials: [null, ...serials.slice(1)],
        observed_serials: serials,
        artifact_refs: [null, ...serials.slice(1).map((serial) => `artifact-3-${serial}`)],
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      'Each run must contain exactly five unique expected and observed serials',
      'Run 3 must include five completed target outcomes with artifacts',
    ]));
  });

  it('rejects coerced run IDs and target serial identifiers', () => {
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3, {
        run_id: 3,
        per_target_outcomes: serials.map((serial, index) => ({
          serial: index === 0 ? 123 : serial,
          status: 'COMPLETED',
          artifact_refs: [`artifact-3-${serial}`],
        })),
      }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      'Sequence run IDs must be present and unique',
      'Run 3 must include five completed target outcomes with artifacts',
    ]));
  });

  it('requires string backend, auth, project, and workflow context', () => {
    const result = validatePilotScaleSequence([1, 2, 3].map((index) => acceptedRun(index, {
      backend_mode: 1,
      auth_mode: 2,
      supabase_project: 3,
      workflow_key: 'instagram_warmup',
      workflow_version: 1,
    })));

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Sequence material context must remain unchanged');
  });

  it('keeps workflow version representation stable across runs', () => {
    const result = validatePilotScaleSequence([
      acceptedRun(1),
      acceptedRun(2),
      acceptedRun(3, { workflow_version: '1' }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Sequence material context must remain unchanged');
  });

});
