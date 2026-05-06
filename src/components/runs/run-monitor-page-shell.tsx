import { XCircle } from 'lucide-react';
import Spinner from '../ui/Spinner';

export function RunMonitorLoadingState() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export function RunMonitorNotFoundState({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <XCircle className="mb-4 h-16 w-16 text-red-500" />
      <h2 className="mb-2 text-2xl font-bold">Run Not Found</h2>
      <button onClick={onBack} className="text-blue-600 hover:text-blue-700">
        Back to Runs
      </button>
    </div>
  );
}
