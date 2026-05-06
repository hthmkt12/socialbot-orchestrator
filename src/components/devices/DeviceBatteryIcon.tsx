import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react';

export function DeviceBatteryIcon({ level, charging }: { level?: number; charging?: boolean }) {
  if (charging) return <BatteryCharging className="w-4 h-4 text-emerald-500" />;
  if (level == null) return <Battery className="w-4 h-4 text-gray-400" />;
  if (level < 20) return <BatteryLow className="w-4 h-4 text-red-500" />;
  if (level < 60) return <BatteryMedium className="w-4 h-4 text-amber-500" />;
  return <BatteryFull className="w-4 h-4 text-emerald-500" />;
}
