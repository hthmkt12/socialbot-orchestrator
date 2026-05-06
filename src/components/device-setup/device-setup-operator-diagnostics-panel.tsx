import Badge from '../ui/Badge';
import type { DeviceSetupDiagnostic } from '../../lib/device-setup-diagnostics';
import {
  DiagnosticCard,
  StatCard,
} from './device-setup-cards';

export function OperatorDiagnosticsPanel({
  activeLockCount,
  deviceLocksError,
  diagnostics,
  expiredLockCount,
}: {
  activeLockCount: number;
  deviceLocksError: string | null;
  diagnostics: DeviceSetupDiagnostic[];
  expiredLockCount: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Operator diagnostics</h4>
          <p className="text-xs text-gray-500 mt-1">
            Actionable explanations for gateway reachability, missing permissions, stale devices, and lock contention.
          </p>
        </div>
        <Badge variant={diagnostics.length > 0 ? 'yellow' : 'green'}>
          {diagnostics.length > 0 ? `${diagnostics.length} issue(s)` : 'No active issues'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Active Locks"
          value={deviceLocksError ? '--' : String(activeLockCount)}
          hint={deviceLocksError ? 'device_locks query failed' : 'Locks still blocking devices right now'}
          tone={deviceLocksError ? 'red' : activeLockCount > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          title="Expired Locks"
          value={deviceLocksError ? '--' : String(expiredLockCount)}
          hint={deviceLocksError ? 'Lock cleanup visibility unavailable' : 'Expired leases that may need cleanup'}
          tone={deviceLocksError ? 'red' : expiredLockCount > 0 ? 'blue' : 'gray'}
        />
        <StatCard
          title="Diagnostics"
          value={String(diagnostics.length)}
          hint="Derived from health checks, device state, probes, and lock rows"
          tone={diagnostics.length > 0 ? 'yellow' : 'green'}
        />
      </div>

      {diagnostics.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-900">No blocking diagnostics found</p>
              <p className="text-xs text-emerald-800 mt-1">
                Gateway, worker, device freshness, probe results, and visible lock rows do not currently show an operator-facing issue.
              </p>
            </div>
            <Badge variant="green">Healthy</Badge>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {diagnostics.map((diagnostic) => (
            <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} />
          ))}
        </div>
      )}
    </div>
  );
}
