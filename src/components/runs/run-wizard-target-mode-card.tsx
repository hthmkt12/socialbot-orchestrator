import type { TargetType } from '../../lib/database.types';
import { targetOptions } from './run-wizard-types';

export function RunWizardTargetModeCard({
  declaredTargetType,
  onTargetTypeChange,
  targetType,
  type,
}: {
  declaredTargetType: TargetType | null;
  onTargetTypeChange: (targetType: TargetType) => void;
  targetType: TargetType;
  type: TargetType;
}) {
  const option = targetOptions.find((candidate) => candidate.type === type);

  if (!option) {
    return null;
  }

  const isActive = targetType === option.type;
  const isLockedByMacro = !!declaredTargetType && declaredTargetType !== option.type;
  const OptionIcon = option.icon;

  return (
    <button
      type="button"
      disabled={isLockedByMacro}
      onClick={() => onTargetTypeChange(option.type)}
      className={`p-4 rounded-xl border text-left transition-all ${
        isActive ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      } ${isLockedByMacro ? 'cursor-not-allowed opacity-45 hover:border-gray-200 hover:bg-white' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <OptionIcon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-gray-500'}`} />
        <span className={`text-sm font-medium ${isActive ? 'text-sky-700' : 'text-gray-700'}`}>{option.label}</span>
      </div>
      <p className="text-xs text-gray-500">{option.description}</p>
      {isLockedByMacro && (
        <p className="text-[11px] text-gray-400 mt-2">
          Not allowed by the selected macro contract
        </p>
      )}
    </button>
  );
}
