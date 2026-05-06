import { Clock3, Lock } from 'lucide-react';
import Badge from '../ui/Badge';
import type { DeviceLockState } from '../../lib/device-locks';

export default function DeviceLockBadge({ lockState }: { lockState: DeviceLockState }) {
  if (lockState.activeLock) {
    return (
      <Badge variant="red">
        <Lock className="w-3 h-3 mr-1" />
        Locked
      </Badge>
    );
  }

  if (lockState.latestExpiredLock) {
    return (
      <Badge variant="yellow">
        <Clock3 className="w-3 h-3 mr-1" />
        Expired lock
      </Badge>
    );
  }

  return null;
}
