import { Activity, Database, Server, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import { useSystemMonitor } from '../hooks/use-system-monitor';

export default function SystemMonitorPage() {
  const { data: metrics, isLoading, isError } = useSystemMonitor(5000);

  return (
    <>
      <Header
        title="System Monitor"
        subtitle="Platform health and queue metrics"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading && !metrics ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : isError || !metrics ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            Failed to load system metrics.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Database Health */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                <Database className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-800">Database</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <div className="flex items-center gap-1.5">
                    {metrics.database.status === 'ONLINE' ? (
                      <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm font-medium text-emerald-700">Online</span></>
                    ) : (
                      <><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm font-medium text-red-700">Error</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Latency</span>
                  <span className="text-sm font-medium text-gray-900">{metrics.database.latencyMs}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last Checked</span>
                  <span className="text-sm font-medium text-gray-900">{new Date(metrics.database.lastChecked).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Worker Pool */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                <Server className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-800">Worker Pool</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active Workers</span>
                  <span className="text-2xl font-bold text-gray-900">{metrics.activeWorkers}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Workers are inferred from active run leases. Idle workers are not counted.
                </p>
              </div>
            </div>

            {/* Queue Backlog */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                <Activity className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-800">Queue Metrics</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Queued Runs</span>
                  <span className="text-sm font-medium text-gray-900">{metrics.queue.queuedRuns}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Running</span>
                  <span className="text-sm font-medium text-emerald-600">{metrics.queue.runningRuns}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Stalled</span>
                  <div className="flex items-center gap-1.5">
                    {metrics.queue.stalledRuns > 0 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    <span className={`text-sm font-medium ${metrics.queue.stalledRuns > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                      {metrics.queue.stalledRuns}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Failed (24h)</span>
                  <span className={`text-sm font-medium ${metrics.queue.failedLast24h > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {metrics.queue.failedLast24h}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
