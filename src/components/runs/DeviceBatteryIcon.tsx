import {
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
} from 'lucide-react';

export function DeviceBatteryIcon({
  charging,
  level,
}: {
  charging?: boolean;
  level?: number;
}) {
  if (charging) return <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />;
  if (level == null) return <Battery className="w-3.5 h-3.5 text-gray-400" />;
  if (level < 20) return <BatteryLow className="w-3.5 h-3.5 text-red-500" />;
  if (level < 60) return <BatteryMedium className="w-3.5 h-3.5 text-amber-500" />;
  return <BatteryFull className="w-3.5 h-3.5 text-emerald-500" />;
}
