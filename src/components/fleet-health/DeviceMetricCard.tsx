import { Smartphone, Activity, AlertTriangle, PlayCircle } from 'lucide-react';

interface DeviceMetricCardProps {
  title: string;
  value: number | string;
  icon: 'Smartphone' | 'Activity' | 'AlertTriangle' | 'PlayCircle';
  color: 'blue' | 'emerald' | 'amber' | 'red';
  subtitle?: string;
}

const icons = {
  Smartphone,
  Activity,
  AlertTriangle,
  PlayCircle
};

const colors = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600'
};

export function DeviceMetricCard({ title, value, icon, color, subtitle }: DeviceMetricCardProps) {
  const Icon = icons[icon];
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
