import { AlertTriangle, ExternalLink } from 'lucide-react';

const TROUBLESHOOTING = [
  {
    problem: 'Gateway health check fails',
    causes: [
      'Gateway process is not running on the configured host and port.',
      'Browser is blocked by mixed-content rules when the app is loaded over HTTPS but the gateway is plain HTTP.',
      'CORS or local firewall is blocking the request.',
    ],
    fix: 'Start the gateway locally, use an HTTP app origin for local ops work, or proxy the gateway behind the same trusted origin.',
  },
  {
    problem: 'Device shows up but heartbeat is stale',
    causes: [
      'AutoJS agent is paused, background-killed, or disconnected from the gateway.',
      'The device is on a different network path than the gateway.',
    ],
    fix: 'Re-open the agent, confirm the websocket URL, remove battery restrictions, then rerun verification.',
  },
  {
    problem: 'Current-app probe fails',
    causes: [
      'The device is registered but no longer reachable in the live gateway session.',
      'The agent script is outdated or not handling the current protocol.',
    ],
    fix: 'Refresh the script from this page, reconnect the device, and verify the gateway session is fresh before retrying.',
  },
  {
    problem: 'Screenshot probe fails',
    causes: [
      'Screen capture permission was denied or not granted persistently.',
      'The device is locked down by OEM battery or permission policies.',
    ],
    fix: 'Grant screen-capture permission again, keep AutoJS exempt from battery optimization, and rerun the screenshot probe.',
  },
];

export function DeviceSetupTroubleshootTab() {
  return (
    <div className="space-y-4">
      {TROUBLESHOOTING.map((item) => (
        <div key={item.problem} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-start gap-3 p-4 bg-red-50 border-b border-red-100">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <h4 className="text-sm font-semibold text-red-900">{item.problem}</h4>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Possible causes</p>
              <div className="space-y-1.5">
                {item.causes.map((cause) => (
                  <div key={cause} className="flex items-start gap-2 text-xs text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                    <span>{cause}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Suggested fix</p>
              <p className="text-xs text-emerald-800 mt-1">{item.fix}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="w-4 h-4 text-sky-500" />
          <h4 className="text-base font-semibold text-gray-900">Reference notes</h4>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>AutoJS background execution must survive OEM battery policies, or the heartbeat will drift stale/offline.</p>
          <p>If the app is hosted over HTTPS and your gateway is plain HTTP, browser mixed-content rules may block verification entirely.</p>
          <p>Persisted device health depends on the gateway having both <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>.</p>
        </div>
      </div>
    </div>
  );
}
