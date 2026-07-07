import { RefreshCw } from 'lucide-react';
import Spinner from '../ui/Spinner';

interface DeviceSyncActionProps {
  canSync: boolean;
  pending: boolean;
  onSync: () => void;
}

export function DevicesPageSyncAction({
  canSync,
  pending,
  onSync,
}: DeviceSyncActionProps) {
  return (
    <button
      onClick={onSync}
      disabled={pending || !canSync}
      className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
    >
      {pending ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
      Sync Devices
    </button>
  );
}

export function DeviceLocksUnavailableNotice({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-800">
        Device lock visibility is unavailable
      </p>
      <p className="mt-1 text-xs text-amber-700">{message}</p>
    </div>
  );
}
