import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Badge from '../ui/Badge';
import type { DeviceSetupDiagnostic } from '../../lib/device-setup-diagnostics';
export {
  CheckRow,
  RecoveryActionCard,
  StatCard,
} from './device-setup-card-primitives';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  );
}

export function CodeBlock({ code, filename }: { code: string; filename: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-400 font-mono">{filename}</span>
        <CopyButton text={code} label="Copy Code" />
      </div>
      <pre className="overflow-x-auto p-4 text-xs font-mono text-gray-200 leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

function diagnosticSeverityAppearance(severity: DeviceSetupDiagnostic['severity']) {
  if (severity === 'critical') {
    return {
      badgeVariant: 'red' as const,
      label: 'Critical',
      panelClass: 'border-red-200 bg-red-50',
      actionClass: 'border-red-100 bg-white',
    };
  }

  if (severity === 'warning') {
    return {
      badgeVariant: 'yellow' as const,
      label: 'Warning',
      panelClass: 'border-amber-200 bg-amber-50',
      actionClass: 'border-amber-100 bg-white',
    };
  }

  return {
    badgeVariant: 'blue' as const,
    label: 'Info',
    panelClass: 'border-sky-200 bg-sky-50',
    actionClass: 'border-sky-100 bg-white',
  };
}

export function DiagnosticCard({ diagnostic }: { diagnostic: DeviceSetupDiagnostic }) {
  const appearance = diagnosticSeverityAppearance(diagnostic.severity);

  return (
    <div className={`rounded-2xl border p-4 ${appearance.panelClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{diagnostic.title}</p>
          <p className="text-xs text-gray-600 mt-1">{diagnostic.reason}</p>
        </div>
        <Badge variant={appearance.badgeVariant}>{appearance.label}</Badge>
      </div>

      {diagnostic.affected && (
        <p className="text-[11px] text-gray-500 mt-3">Affected: {diagnostic.affected}</p>
      )}

      <div className={`rounded-xl border mt-3 p-3 ${appearance.actionClass}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recommended action</p>
        <p className="text-xs text-gray-700 mt-1">{diagnostic.recommendation}</p>
      </div>
    </div>
  );
}
