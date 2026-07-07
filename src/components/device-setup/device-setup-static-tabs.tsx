import { Check } from 'lucide-react';
import Badge from '../ui/Badge';
import { CodeBlock } from './device-setup-cards';
import {
  DeviceSetupGuideSupportPanels,
  DeviceSetupProtocolSupportPanels,
} from './device-setup-static-tab-panels';
import { GATEWAY_PROTOCOL_EXAMPLE } from '../../lib/device-setup';
export { DeviceSetupTroubleshootTab } from './device-setup-troubleshoot-tab';

const GUIDE_STEPS = [
  {
    title: 'Install AutoJS Pro',
    detail: 'Use AutoJS Pro 9.x or newer on the Android device that will act as the device bridge agent.',
    bullets: [
      'Enable Accessibility Service before running the agent script.',
      'Allow background execution so the websocket session survives screen-off conditions.',
    ],
  },
  {
    title: 'Configure Gateway And Worker',
    detail: 'Run the gateway and worker with reachable HTTP endpoints before onboarding a device.',
    bullets: [
      'Gateway default: http://127.0.0.1:8080',
      'Worker default: http://127.0.0.1:4310',
      'For persisted device health, start the gateway with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    ],
  },
  {
    title: 'Run Verification First',
    detail: 'Use the Verify tab to check reachability, registration, heartbeat freshness, and live probes before trusting the device.',
    bullets: [
      'Current-app probe validates dispatch and response flow.',
      'Screenshot probe validates screen-capture permission and artifact transport.',
    ],
  },
];

export function DeviceSetupGuideTab({
  autoJsScript,
  gatewayWsUrl,
  supabaseAnonKey,
  supabaseUrl,
}: {
  autoJsScript: string;
  gatewayWsUrl: string;
  supabaseAnonKey: string | undefined;
  supabaseUrl: string | undefined;
}) {
  const envReferences = [
    { label: 'Supabase URL', value: supabaseUrl ?? 'Missing VITE_SUPABASE_URL' },
    {
      label: 'Supabase anon key',
      value: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 40)}...` : 'Missing VITE_SUPABASE_ANON_KEY',
    },
    { label: 'Gateway websocket URL', value: gatewayWsUrl },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr,1.1fr] gap-6">
      <div className="space-y-4">
        {GUIDE_STEPS.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 font-semibold flex-shrink-0">
                {index + 1}
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-gray-900">{step.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{step.detail}</p>
                <div className="space-y-1.5 mt-3">
                  {step.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-2 text-xs text-gray-500">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <DeviceSetupGuideSupportPanels autoJsScript={autoJsScript} envReferences={envReferences} />
      </div>
    </div>
  );
}

export function DeviceSetupProtocolTab() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900">Gateway websocket contract</h4>
            <p className="text-xs text-gray-500 mt-1">
              This is the device-facing protocol that the AutoJS agent must implement.
            </p>
          </div>
          <Badge variant="gray">Protocol v1</Badge>
        </div>
        <CodeBlock code={GATEWAY_PROTOCOL_EXAMPLE} filename="protocol.jsonc" />
      </div>

      <DeviceSetupProtocolSupportPanels />
    </div>
  );
}
