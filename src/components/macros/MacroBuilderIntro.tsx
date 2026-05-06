import { GUIDED_BUILDER_STEPS } from '../../lib/macro-builder';
import Badge from '../ui/Badge';

export function MacroBuilderIntro() {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
      <p className="text-sm font-semibold text-sky-900">Guided Builder</p>
      <p className="text-sm text-sky-800 mt-1">
        Use this for common flat workflows. Advanced branching, grouped steps, and rare step types still belong in Raw JSON mode.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {GUIDED_BUILDER_STEPS.map((step) => (
          <Badge key={step.type} variant="blue">{step.label}</Badge>
        ))}
      </div>
    </div>
  );
}
