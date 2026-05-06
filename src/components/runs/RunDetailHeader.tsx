import { ArrowLeft, XCircle } from 'lucide-react';
import Header from '../layout/Header';

interface RunDetailHeaderProps {
  cancelPending: boolean;
  canCancelRun: boolean;
  isRunning: boolean;
  runId: string;
  status: string;
  onBack: () => void;
  onCancel: () => void;
}

export function RunDetailHeader({
  cancelPending,
  canCancelRun,
  isRunning,
  runId,
  status,
  onBack,
  onCancel,
}: RunDetailHeaderProps) {
  return (
    <Header
      title={`Run ${runId.slice(0, 8)}`}
      subtitle={status.replace(/_/g, ' ')}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {isRunning && canCancelRun && (
            <button onClick={onCancel} disabled={cancelPending} className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
              <XCircle className="w-4 h-4" /> Cancel Run
            </button>
          )}
        </div>
      }
    />
  );
}
