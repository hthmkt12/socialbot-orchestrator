import {
  Clock,
  FileText,
  Play,
  Code,
  ShieldCheck,
  Smartphone,
  Users,
  Settings,
} from 'lucide-react';
import type { AuditTone } from '../../lib/audit-log-insights';

type AuditRowIcon = typeof Clock;

export const actionConfig: Record<string, { icon: AuditRowIcon; variant: AuditTone }> = {
  'run.create': { icon: Play, variant: 'blue' },
  'run.dispatch_requested': { icon: Play, variant: 'teal' },
  'run.complete': { icon: Play, variant: 'green' },
  'run.cancel': { icon: Play, variant: 'red' },
  'macro.create': { icon: Code, variant: 'teal' },
  'macro_version.create': { icon: Code, variant: 'teal' },
  'macro_version.activate': { icon: Code, variant: 'green' },
  'devices.sync': { icon: Smartphone, variant: 'blue' },
  'device_group.create': { icon: Users, variant: 'blue' },
  'device_group.add_device': { icon: Users, variant: 'teal' },
  'device_group.remove_device': { icon: Users, variant: 'orange' },
  'approval.requested': { icon: ShieldCheck, variant: 'yellow' },
  'approval.approved': { icon: ShieldCheck, variant: 'green' },
  'approval.rejected': { icon: ShieldCheck, variant: 'red' },
};

export const resourceIcons: Record<string, AuditRowIcon> = {
  workflow_run: Play,
  macro: Code,
  macro_version: Code,
  device: Smartphone,
  device_group: Users,
  approval: ShieldCheck,
  execution_profile: Settings,
};

export const toneSurfaceClasses: Record<AuditTone, string> = {
  green: 'bg-emerald-50 text-emerald-500',
  red: 'bg-red-50 text-red-500',
  yellow: 'bg-amber-50 text-amber-500',
  blue: 'bg-sky-50 text-sky-500',
  gray: 'bg-gray-50 text-gray-500',
  orange: 'bg-orange-50 text-orange-500',
  teal: 'bg-teal-50 text-teal-500',
};

export const toneButtonClasses: Record<AuditTone, string> = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  red: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  yellow: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  blue: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  gray: 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100',
  orange: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',
  teal: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
};

export function getTimeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const defaultAuditRowConfig = {
  icon: FileText,
  variant: 'gray' as AuditTone,
};
