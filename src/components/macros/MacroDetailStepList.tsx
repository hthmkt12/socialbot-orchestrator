import Badge from '../ui/Badge';
import type { MacroStep } from '../../contracts/macro';
import { macroDetailStepTypeConfig } from './macro-detail-step-config';

interface MacroDetailStepListProps {
  steps: MacroStep[];
  depth: number;
}

export function MacroDetailStepList({ steps, depth }: MacroDetailStepListProps) {
  return (
    <div className="space-y-2" style={{ marginLeft: depth * 16 }}>
      {steps.map((step, index) => (
        <MacroDetailStepItem key={step.id} index={index} step={step} />
      ))}
    </div>
  );
}

function MacroDetailStepItem({ index, step }: { index: number; step: MacroStep }) {
  const config = macroDetailStepTypeConfig[step.type] ?? macroDetailStepTypeConfig.wait;
  const StepIcon = config.icon;
  const [iconColor, iconBg] = config.color.split(' ');

  return (
    <div>
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
        <span className="text-[10px] text-gray-400 font-mono w-5 text-right flex-shrink-0">{index + 1}</span>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <StepIcon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{config.label}</span>
            <span className="text-[10px] font-mono text-gray-400">{step.id}</span>
          </div>
          {Object.keys(step.params).length > 0 && (
            <p className="text-[10px] text-gray-500 truncate">
              {Object.entries(step.params).map(([key, value]) => `${key}: ${String(value)}`).join(', ')}
            </p>
          )}
        </div>
        {step.policy && (
          <div className="flex gap-1 flex-shrink-0">
            {step.policy.timeoutMs && <Badge variant="gray">{(step.policy.timeoutMs / 1000).toFixed(0)}s</Badge>}
            {step.policy.maxRetries != null && step.policy.maxRetries > 0 && <Badge variant="blue">{step.policy.maxRetries}x retry</Badge>}
            {step.policy.requiresApproval && <Badge variant="yellow">approval</Badge>}
          </div>
        )}
      </div>
      <NestedSteps label="THEN" labelClassName="text-emerald-600" steps={step.then} borderClassName="border-emerald-200" />
      <NestedSteps label="ELSE" labelClassName="text-red-600" steps={step.else} borderClassName="border-red-200" />
      <NestedSteps steps={step.steps} borderClassName="border-gray-200" />
    </div>
  );
}

function NestedSteps({
  borderClassName,
  label,
  labelClassName,
  steps,
}: {
  borderClassName: string;
  label?: string;
  labelClassName?: string;
  steps: MacroStep[] | undefined;
}) {
  if (!steps?.length) return null;

  return (
    <div className={`ml-5 mt-1 pl-3 border-l-2 ${borderClassName}`}>
      {label && <p className={`text-[10px] font-medium mb-1 ml-1 ${labelClassName}`}>{label}</p>}
      <MacroDetailStepList steps={steps} depth={0} />
    </div>
  );
}
