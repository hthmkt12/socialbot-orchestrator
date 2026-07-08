import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, FileCheck2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import { useCreateReadinessReport, useReadinessReports, useReviewReadinessReport } from '../hooks/use-readiness-reports';
import { canCreateReadinessReports, canReviewReadinessReports, getRoleLabel } from '../lib/role-access';
import type { PilotReadinessBackend, PilotReadinessReport, PilotReadinessStatus } from '../lib/database.types';
import {
  getReadinessEvidenceFreshness,
  getReadinessReportGates,
  type ReadinessReviewDecision,
} from '../lib/readiness-report-service';
import {
  compactReadinessEvidence,
  createInitialReadinessEvidence,
  getReadinessEvidenceFieldKeysForBackend,
  readinessEvidenceFieldMeta,
  type ReadinessEvidenceForm,
} from '../lib/readiness-report-form-helpers';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

const backendOptions: Array<{ value: PilotReadinessBackend; label: string }> = [
  { value: 'mobile_mcp', label: 'Mobile MCP' },
  { value: 'laixi', label: 'LAIXI' },
  { value: 'ios_portal', label: 'iOS Portal' },
  { value: 'unknown', label: 'Unknown' },
];

const statusStyles: Record<PilotReadinessStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-sky-100 text-sky-700',
  pilot_verified: 'bg-emerald-100 text-emerald-700',
  not_verified: 'bg-red-100 text-red-700',
  needs_rerun: 'bg-amber-100 text-amber-700',
};

const freshnessStyles = {
  fresh: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-red-100 text-red-700',
  missing: 'bg-amber-100 text-amber-700',
  invalid: 'bg-red-100 text-red-700',
};

function formatStatus(status: PilotReadinessStatus) {
  return status.replace(/_/g, ' ');
}

function formatBackend(backend: PilotReadinessBackend) {
  return backendOptions.find((option) => option.value === backend)?.label ?? backend;
}

function getEvidenceSummary(report: PilotReadinessReport) {
  const evidence = report.evidence_json;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return [];
  return Object.entries(evidence as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 6);
}

function gateStyle(status: string, type: string) {
  if (status === 'passed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (type === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

function formatFreshnessDetail(report: PilotReadinessReport) {
  const freshness = getReadinessEvidenceFreshness(report.evidence_json);
  if (freshness.status === 'fresh' && freshness.expiresAt) {
    return `Fresh evidence; expires ${new Date(freshness.expiresAt).toLocaleDateString()}`;
  }
  if (freshness.status === 'expired' && freshness.ageDays !== null) {
    return `Expired evidence; age ${Math.floor(freshness.ageDays)} days`;
  }
  return freshness.label;
}

export default function ReadinessReportsPage() {
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const { data: reports, isLoading } = useReadinessReports();
  const createReport = useCreateReadinessReport();
  const reviewReport = useReviewReadinessReport();
  const [backend, setBackend] = useState<PilotReadinessBackend>('mobile_mcp');
  const [reportPath, setReportPath] = useState('');
  const [evidence, setEvidence] = useState<ReadinessEvidenceForm>(() => createInitialReadinessEvidence('mobile_mcp'));
  const canCreate = canCreateReadinessReports(profile?.role);
  const canReview = canReviewReadinessReports(profile?.role);

  async function handleCreateReport() {
    if (!canCreate) {
      addToast('Only operators and admins can submit readiness reports', 'error');
      return;
    }

    try {
      await createReport.mutateAsync({
        backend,
        report_path: reportPath,
        evidence_json: compactReadinessEvidence({
          ...evidence,
          backend_mode: evidence.backend_mode || backend,
        }),
      });
      setReportPath('');
      setEvidence(createInitialReadinessEvidence(backend));
      addToast('Readiness report submitted', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to submit readiness report', 'error', 5000);
    }
  }

  async function handleReview(report: PilotReadinessReport, decision: ReadinessReviewDecision) {
    if (!canReview) {
      addToast('Only admins can review readiness reports', 'error');
      return;
    }

    try {
      await reviewReport.mutateAsync({
        id: report.id,
        decision,
        reviewNotes: decision === 'pilot_verified'
          ? 'Pilot evidence verified by admin.'
          : decision === 'needs_rerun'
            ? 'Evidence needs another run before pilot.'
            : 'Evidence is not sufficient for pilot verification.',
      });
      addToast(`Readiness marked ${formatStatus(decision)}`, 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to review readiness report', 'error', 5000);
    }
  }

  return (
    <>
      <Header title="Readiness" subtitle="Review pilot evidence before safe scale" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Current role: {getRoleLabel(profile?.role)}</p>
                <p className="text-sm text-gray-500">
                  Operators submit evidence. Admins make the pilot go/no-go decision.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ShieldCheck className="w-4 h-4 text-sky-500" />
                {canReview ? 'Admin review enabled' : canCreate ? 'Submission enabled' : 'Read-only access'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Submit Report</h2>
                <Plus className="w-4 h-4 text-gray-400" />
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Backend
                <select
                  value={backend}
                  onChange={(event) => {
                    const selectedBackend = event.target.value as PilotReadinessBackend;
                    setBackend(selectedBackend);
                    setEvidence((current) => ({ ...current, backend_mode: selectedBackend }));
                  }}
                  disabled={!canCreate}
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-sky-500 focus:ring-sky-500 disabled:bg-gray-100"
                >
                  {backendOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Report path
                <input
                  value={reportPath}
                  onChange={(event) => setReportPath(event.target.value)}
                  disabled={!canCreate}
                  placeholder="docs/report.md or run artifact URL"
                  className="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-sky-500 focus:ring-sky-500 disabled:bg-gray-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-3">
                {getReadinessEvidenceFieldKeysForBackend(backend).map((key) => (
                  <label key={key} className="block text-sm font-medium text-gray-700">
                    {readinessEvidenceFieldMeta[key].label}
                    <input
                      value={evidence[key]}
                      placeholder={readinessEvidenceFieldMeta[key].placeholder}
                      onChange={(event) => setEvidence((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))}
                      disabled={!canCreate}
                      className="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-sky-500 focus:ring-sky-500 disabled:bg-gray-100"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCreateReport}
                disabled={!canCreate || createReport.isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {createReport.isPending ? <Spinner size="sm" /> : <FileCheck2 className="w-4 h-4" />}
                Submit readiness
              </button>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex justify-center">
                  <Spinner size="md" />
                </div>
              ) : reports && reports.length > 0 ? (
                reports.map((report) => {
                  const freshness = getReadinessEvidenceFreshness(report.evidence_json);
                  const gates = getReadinessReportGates(report);
                  const blockingReadinessGate = gates.find((gate) => gate.type !== 'warning' && gate.status === 'failed');
                  const verifyDisabledReason = !canReview
                    ? 'Only admins can verify readiness reports'
                    : blockingReadinessGate
                      ? `Resolve blocker: ${blockingReadinessGate.message}`
                      : undefined;
                  return (
                  <div key={report.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">{formatBackend(report.backend)}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[report.status]}`}>
                            {formatStatus(report.status)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${freshnessStyles[freshness.status]}`}>
                            {freshness.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{report.report_path || 'No report path provided'}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatFreshnessDetail(report)}</p>
                      </div>
                      <p className="text-xs text-gray-400">{new Date(report.created_at).toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {getEvidenceSummary(report).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">{key}</p>
                          <p className="text-sm text-gray-700 break-words">{String(value)}</p>
                        </div>
                      ))}
                    </div>

                    {report.review_notes && (
                      <p className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">{report.review_notes}</p>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Readiness gates</p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {gates.map((gate) => (
                          <div key={gate.key} className={`rounded-lg border px-3 py-2 ${gateStyle(gate.status, gate.type)}`}>
                            <div className="flex items-start gap-2">
                              {gate.status === 'passed' ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                              ) : gate.type === 'warning' ? (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              ) : (
                                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{gate.message}</p>
                                <p className="text-xs opacity-80">{gate.recoveryHint}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-wide opacity-70">{gate.type.replace(/_/g, ' ')} · {gate.status}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleReview(report, 'pilot_verified')}
                        disabled={!canReview || reviewReport.isPending || Boolean(blockingReadinessGate)}
                        title={verifyDisabledReason}
                        aria-label={verifyDisabledReason ?? 'Verify readiness report'}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(report, 'needs_rerun')}
                        disabled={!canReview || reviewReport.isPending}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Rerun
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(report, 'not_verified')}
                        disabled={!canReview || reviewReport.isPending}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <CircleSlash className="w-4 h-4" />
                        Not verified
                      </button>
                      {blockingReadinessGate && (
                        <p className="w-full text-xs text-red-600">
                          Verify blocked: {blockingReadinessGate.message}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                  <FileCheck2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-medium text-gray-900">No readiness reports yet</h3>
                  <p className="mt-2 text-sm text-gray-500">Submit pilot evidence before marking any backend ready.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
