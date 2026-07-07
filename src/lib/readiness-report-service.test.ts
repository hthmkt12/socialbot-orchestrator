import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./audit', () => ({
  logAudit: vi.fn(),
}));

import { logAudit } from './audit';
import {
  createReadinessReport,
  reviewReadinessReport,
  sanitizeReadinessEvidence,
  validateReadinessEvidence,
} from './readiness-report-service';
import { supabase } from './supabase';

const mockFrom = vi.mocked(supabase.from) as Mock;
const mockLogAudit = vi.mocked(logAudit) as Mock;

function profileTable(role: string, userId = 'user-1') {
  return {
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: userId, role },
        error: null,
      }),
    }),
  };
}

function createReportTable() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'report-1',
      backend: 'mobile_mcp',
      status: 'submitted',
      report_path: 'docs/pilot.md',
      evidence_json: {},
      created_by_user_id: 'operator-1',
      reviewed_by_user_id: null,
      reviewed_at: null,
      review_notes: null,
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    },
    error: null,
  });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert };
}

function reviewReportTable() {
  const existing = {
    id: 'report-1',
    backend: 'mobile_mcp',
    status: 'submitted',
    report_path: 'docs/pilot.md',
    evidence_json: {
      runtimeStatus: 'ok',
      reportStatus: 'pass',
      deviceSerial: 'device-1',
      runId: 'run-1',
      smokeResult: 'pass',
    },
    created_by_user_id: 'operator-1',
    reviewed_by_user_id: null,
    reviewed_at: null,
    review_notes: null,
    created_at: '2026-07-07T00:00:00Z',
    updated_at: '2026-07-07T00:00:00Z',
  };
  const updated = { ...existing, status: 'pilot_verified', reviewed_by_user_id: 'admin-1' };
  const selectMaybeSingle = vi.fn().mockResolvedValueOnce({ data: existing, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
  const updateMaybeSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  return {
    select: vi.fn().mockReturnValue({ eq: selectEq }),
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  };
}

describe('readiness report service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips secret-like fields before persisting evidence', () => {
    expect(sanitizeReadinessEvidence({
      runtimeStatus: 'ok',
      nested: {
        apiKey: 'do-not-store',
        safe: 'keep',
      },
      token: 'do-not-store',
    })).toEqual({
      runtimeStatus: 'ok',
      nested: {
        safe: 'keep',
      },
    });
  });

  it('rejects pilot verification when required evidence is missing', () => {
    expect(validateReadinessEvidence({
      backend: 'mobile_mcp',
      decision: 'pilot_verified',
      evidence: { runtimeStatus: 'ok' },
    })).toEqual({
      valid: false,
      issues: ['Device serial or session id evidence is required', 'Completed run id or smoke result evidence is required'],
    });
  });

  it('requires backend-specific proof for LAIXI pilot verification', () => {
    expect(validateReadinessEvidence({
      backend: 'laixi',
      decision: 'pilot_verified',
      evidence: {
        runtimeStatus: 'ok',
        reportStatus: 'pass',
        deviceSerial: 'device-1',
        runId: 'run-1',
      },
    })).toMatchObject({ valid: false });
  });

  it('allows operators to create submitted reports and writes an audit event', async () => {
    const reportTable = createReportTable();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('OPERATOR', 'operator-1');
      if (table === 'pilot_readiness_reports') return reportTable;
      return {};
    });

    await expect(createReadinessReport({
      backend: 'mobile_mcp',
      report_path: 'docs/pilot.md',
      evidence_json: { runtimeStatus: 'ok', token: 'secret' },
    })).resolves.toMatchObject({ id: 'report-1' });

    expect(reportTable.insert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'submitted',
      created_by_user_id: 'operator-1',
      evidence_json: { runtimeStatus: 'ok' },
    }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      'readiness_report.submit',
      'pilot_readiness_report',
      'report-1',
      expect.objectContaining({ backend: 'mobile_mcp' })
    );
  });

  it('blocks viewers from creating readiness reports', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('VIEWER');
      return {};
    });

    await expect(createReadinessReport({
      backend: 'mobile_mcp',
      evidence_json: {},
    })).rejects.toThrow('Only operators and admins can submit readiness reports');
  });

  it('blocks operators from reviewing readiness reports', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('OPERATOR');
      return {};
    });

    await expect(reviewReadinessReport('report-1', 'pilot_verified')).rejects.toThrow(
      'Only admins can review readiness reports'
    );
  });

  it('lets admins verify reports when evidence is complete', async () => {
    const reportTable = reviewReportTable();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('ADMIN', 'admin-1');
      if (table === 'pilot_readiness_reports') return reportTable;
      return {};
    });

    await expect(reviewReadinessReport('report-1', 'pilot_verified')).resolves.toMatchObject({
      status: 'pilot_verified',
    });
    expect(reportTable.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pilot_verified',
      reviewed_by_user_id: 'admin-1',
    }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      'readiness_report.review',
      'pilot_readiness_report',
      'report-1',
      expect.objectContaining({ decision: 'pilot_verified' })
    );
  });
});
