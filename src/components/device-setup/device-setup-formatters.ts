export type CheckTone = 'pass' | 'warn' | 'fail' | 'idle';

export function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '--';
}

export function checkToneBadge(tone: CheckTone) {
  if (tone === 'pass') return { variant: 'green' as const, label: 'Pass' };
  if (tone === 'warn') return { variant: 'yellow' as const, label: 'Warn' };
  if (tone === 'fail') return { variant: 'red' as const, label: 'Fail' };
  return { variant: 'gray' as const, label: 'Pending' };
}
