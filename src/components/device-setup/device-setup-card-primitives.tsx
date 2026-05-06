import type { ReactNode } from 'react';
import Badge from '../ui/Badge';
import { checkToneBadge, type CheckTone } from './device-setup-formatters';

export function StatCard({
  title,
  value,
  hint,
  tone = 'gray',
}: {
  title: string;
  value: string;
  hint: string;
  tone?: 'gray' | 'green' | 'yellow' | 'red' | 'blue';
}) {
  const toneClass =
    tone === 'green' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
    tone === 'yellow' ? 'text-amber-600 bg-amber-50 border-amber-100' :
    tone === 'red' ? 'text-red-600 bg-red-50 border-red-100' :
    tone === 'blue' ? 'text-sky-600 bg-sky-50 border-sky-100' :
    'text-gray-700 bg-white border-gray-200';

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{title}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      <p className="text-xs mt-2 opacity-80">{hint}</p>
    </div>
  );
}

export function CheckRow({
  title,
  tone,
  detail,
}: {
  title: string;
  tone: CheckTone;
  detail: string;
}) {
  const badge = checkToneBadge(tone);

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-1">{detail}</p>
      </div>
      <Badge variant={badge.variant}>{badge.label}</Badge>
    </div>
  );
}

export function RecoveryActionCard({
  title,
  detail,
  tone = 'gray',
  hint,
  children,
}: {
  title: string;
  detail: string;
  tone?: 'gray' | 'green' | 'yellow' | 'blue';
  hint: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'green' ? 'border-emerald-200 bg-emerald-50' :
    tone === 'yellow' ? 'border-amber-200 bg-amber-50' :
    tone === 'blue' ? 'border-sky-200 bg-sky-50' :
    'border-gray-200 bg-white';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-600 mt-1">{detail}</p>
      </div>
      <div className="mt-4">{children}</div>
      <p className="text-[11px] text-gray-500 mt-3">{hint}</p>
    </div>
  );
}
