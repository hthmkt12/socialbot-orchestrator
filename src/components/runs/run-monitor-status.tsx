import { CheckCircle2, Clock, Pause, RefreshCw, X, XCircle } from 'lucide-react';
import Badge from '../ui/Badge';

export function RunStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'QUEUED':
      return <Badge variant="blue">Queued</Badge>;
    case 'RUNNING':
      return <Badge variant="blue">Running</Badge>;
    case 'COMPLETED':
      return <Badge variant="green">Completed</Badge>;
    case 'FAILED':
      return <Badge variant="red">Failed</Badge>;
    case 'WAITING_APPROVAL':
      return <Badge variant="yellow">Waiting Approval</Badge>;
    case 'CANCELLED':
      return <Badge variant="gray">Cancelled</Badge>;
    case 'PARTIAL_SUCCESS':
      return <Badge variant="orange">Partial Success</Badge>;
    default:
      return <Badge variant="gray">{status}</Badge>;
  }
}

export function RunStepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'SUCCESS':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'FAILED':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'RUNNING':
    case 'RETRYING':
      return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'WAITING_APPROVAL':
      return <Pause className="w-5 h-5 text-yellow-500" />;
    case 'CANCELLED':
      return <X className="w-5 h-5 text-gray-500" />;
    default:
      return <Clock className="w-5 h-5 text-gray-400" />;
  }
}
