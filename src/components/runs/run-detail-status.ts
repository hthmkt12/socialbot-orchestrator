import { AlertTriangle, CheckCircle, ChevronRight, Clock, RefreshCw, XCircle, Zap } from 'lucide-react';

export const runDetailStatusColor: Record<string, string> = {
  PENDING: 'bg-gray-400',
  QUEUED: 'bg-sky-400',
  RUNNING: 'bg-sky-500',
  COMPLETED: 'bg-emerald-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
  PARTIAL_SUCCESS: 'bg-orange-500',
  WAITING_APPROVAL: 'bg-amber-500',
};

export const runDetailStepStatusConfig: Record<string, { variant: string; icon: typeof Clock; color: string }> = {
  PENDING: { variant: 'gray', icon: Clock, color: 'bg-gray-50 text-gray-400' },
  RUNNING: { variant: 'blue', icon: Zap, color: 'bg-sky-50 text-sky-500' },
  SUCCESS: { variant: 'green', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-500' },
  FAILED: { variant: 'red', icon: XCircle, color: 'bg-red-50 text-red-500' },
  SKIPPED: { variant: 'gray', icon: ChevronRight, color: 'bg-gray-50 text-gray-400' },
  RETRYING: { variant: 'yellow', icon: RefreshCw, color: 'bg-amber-50 text-amber-500' },
  CANCELLED: { variant: 'gray', icon: XCircle, color: 'bg-gray-50 text-gray-400' },
  WAITING_APPROVAL: { variant: 'orange', icon: AlertTriangle, color: 'bg-orange-50 text-orange-500' },
};

export function getRunStatusBadgeVariant(status: string) {
  if (status === 'QUEUED' || status === 'RUNNING') return 'blue';
  if (status === 'COMPLETED') return 'green';
  if (status === 'FAILED') return 'red';
  if (status === 'CANCELLED') return 'gray';
  if (status === 'PARTIAL_SUCCESS') return 'orange';
  if (status === 'WAITING_APPROVAL') return 'yellow';
  return 'gray';
}
