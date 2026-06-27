import {
  AsteriskSquare as SquareAsterisk,
  Camera,
  Eye,
  GitBranch,
  Hand,
  MousePointer,
  Navigation,
  Octagon,
  Play as PlayIcon,
  Repeat,
  ShieldCheck,
  Terminal,
  Timer,
  Type,
} from 'lucide-react';

export const macroDetailVersionStatusVariant: Record<string, string> = {
  ACTIVE: 'green',
  DRAFT: 'yellow',
  ARCHIVED: 'gray',
};

export const macroDetailStepTypeConfig: Record<string, { icon: typeof Timer; label: string; color: string }> = {
  wait: { icon: Timer, label: 'Wait', color: 'text-gray-500 bg-gray-50' },
  launch_app: { icon: PlayIcon, label: 'Launch App', color: 'text-sky-600 bg-sky-50' },
  input_text: { icon: Type, label: 'Input Text', color: 'text-teal-600 bg-teal-50' },
  tap: { icon: MousePointer, label: 'Tap', color: 'text-orange-600 bg-orange-50' },
  swipe: { icon: Navigation, label: 'Swipe', color: 'text-orange-600 bg-orange-50' },
  screenshot: { icon: Camera, label: 'Screenshot', color: 'text-sky-600 bg-sky-50' },
  get_current_app: { icon: Eye, label: 'Get App Info', color: 'text-teal-600 bg-teal-50' },
  adb: { icon: Terminal, label: 'ADB Command', color: 'text-red-600 bg-red-50' },
  run_autox: { icon: SquareAsterisk, label: 'AutoJS Script', color: 'text-red-600 bg-red-50' },
  approval_checkpoint: { icon: ShieldCheck, label: 'Approval', color: 'text-amber-600 bg-amber-50' },
  conditional: { icon: GitBranch, label: 'Conditional', color: 'text-sky-600 bg-sky-50' },
  foreach_device: { icon: Repeat, label: 'For Each Device', color: 'text-sky-600 bg-sky-50' },
  group: { icon: Hand, label: 'Group', color: 'text-gray-600 bg-gray-50' },
  loop: { icon: Repeat, label: 'Loop', color: 'text-violet-600 bg-violet-50' },
  ai_task: { icon: Terminal, label: 'AI Task', color: 'text-emerald-600 bg-emerald-50' },
  stop: { icon: Octagon, label: 'Stop', color: 'text-red-600 bg-red-50' },
};
