import { Eye, Lock } from 'lucide-react';

interface Props {
  title: string;
  detail: string;
  tone?: 'info' | 'warning';
}

export default function RoleAccessNotice({
  title,
  detail,
  tone = 'info',
}: Props) {
  const isInfo = tone === 'info';
  const Icon = isInfo ? Eye : Lock;

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      isInfo
        ? 'border-sky-200 bg-sky-50'
        : 'border-amber-200 bg-amber-50'
    }`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
          isInfo ? 'text-sky-600' : 'text-amber-600'
        }`} />
        <div>
          <p className={`text-sm font-medium ${
            isInfo ? 'text-sky-900' : 'text-amber-900'
          }`}>
            {title}
          </p>
          <p className={`text-xs mt-1 ${
            isInfo ? 'text-sky-800' : 'text-amber-800'
          }`}>
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}
