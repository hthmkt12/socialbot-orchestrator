import { PlayCircle, ShieldCheck, Activity, Smartphone } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import type { Device } from '../../lib/database.types';

interface DeviceGridCardProps {
  device: Device & { active_run?: any };
  healthStatus: 'healthy' | 'warning' | 'offline';
  isStalled: boolean;
}

export function DeviceGridCard({ device, healthStatus, isStalled }: DeviceGridCardProps) {
  const getHealthBadge = () => {
    switch (healthStatus) {
      case 'healthy': return <Badge variant="green">Healthy</Badge>;
      case 'warning': return <Badge variant="yellow">Warning</Badge>;
      case 'offline': return <Badge variant="gray">Offline</Badge>;
    }
  };

  return (
    <div className={`bg-white rounded-xl border ${healthStatus === 'warning' ? 'border-amber-200' : 'border-gray-200'} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            healthStatus === 'healthy' ? 'bg-emerald-50 text-emerald-600' : 
            healthStatus === 'warning' ? 'bg-amber-50 text-amber-600' : 
            'bg-gray-50 text-gray-400'
          }`}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{device.name}</h3>
            <p className="text-xs text-gray-500 font-mono">{(device as any).device_id_override || device.id.slice(0,8)}</p>
          </div>
        </div>
        {getHealthBadge()}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            Status
          </span>
          <span className="font-medium text-gray-900 capitalize">
            {device.status.toLowerCase()}
          </span>
        </div>

        {device.active_run && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4" />
              Active Run
            </span>
            <span className={`font-medium ${isStalled ? 'text-red-600' : 'text-blue-600'}`}>
              {isStalled ? 'Stalled' : 'Running'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Last Seen
          </span>
          <span className="font-medium text-gray-900">
            {formatDistanceToNow(device.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
