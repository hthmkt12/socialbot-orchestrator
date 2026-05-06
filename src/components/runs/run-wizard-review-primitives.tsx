import { AlertTriangle } from 'lucide-react';

export function ReviewMetric({
  label,
  labelClassName = '',
  value,
  valueClassName = '',
}: {
  label: string;
  labelClassName?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`text-gray-500 ${labelClassName}`}>{label}</span>
      <span className={`text-gray-900 font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

export function RunPreflightIssueCard({
  detail,
  title,
  tone,
}: {
  detail: string;
  title: string;
  tone: 'amber' | 'red';
}) {
  const colors = tone === 'red'
    ? 'bg-red-50 border-red-200 text-red-500 text-red-800 text-red-600'
    : 'bg-amber-50 border-amber-200 text-amber-500 text-amber-800 text-amber-600';
  const [bg, border, icon, titleColor, detailColor] = colors.split(' ');

  return (
    <div className={`flex items-start gap-3 p-4 ${bg} border ${border} rounded-xl`}>
      <AlertTriangle className={`w-5 h-5 ${icon} flex-shrink-0 mt-0.5`} />
      <div>
        <p className={`text-sm font-medium ${titleColor}`}>{title}</p>
        <p className={`text-xs ${detailColor} mt-0.5`}>{detail}</p>
      </div>
    </div>
  );
}
