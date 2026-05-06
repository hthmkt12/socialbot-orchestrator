import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { RunStatus } from '../../lib/database.types';

export type RunBadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange';

export interface RunStatusConfig {
  variant: RunBadgeVariant;
  icon: LucideIcon;
  label: string;
}

export const runsPageStatusConfig: Record<RunStatus, RunStatusConfig> = {
  PENDING: { variant: 'gray', icon: Clock, label: 'Pending' },
  QUEUED: { variant: 'blue', icon: Clock, label: 'Queued' },
  RUNNING: { variant: 'blue', icon: Zap, label: 'Running' },
  COMPLETED: { variant: 'green', icon: CheckCircle, label: 'Completed' },
  FAILED: { variant: 'red', icon: XCircle, label: 'Failed' },
  CANCELLED: { variant: 'gray', icon: Pause, label: 'Cancelled' },
  PARTIAL_SUCCESS: { variant: 'orange', icon: AlertTriangle, label: 'Partial' },
  WAITING_APPROVAL: { variant: 'yellow', icon: Pause, label: 'Awaiting Approval' },
};

export function isLiveRunStatus(status: RunStatus) {
  return ['RUNNING', 'PENDING', 'QUEUED', 'WAITING_APPROVAL'].includes(status);
}

export function getStatusIconClasses(variant: RunBadgeVariant) {
  switch (variant) {
    case 'green':
      return 'bg-emerald-50 text-emerald-500';
    case 'red':
      return 'bg-red-50 text-red-500';
    case 'blue':
      return 'bg-sky-50 text-sky-500';
    case 'yellow':
      return 'bg-amber-50 text-amber-500';
    case 'orange':
      return 'bg-orange-50 text-orange-500';
    default:
      return 'bg-gray-50 text-gray-500';
  }
}
