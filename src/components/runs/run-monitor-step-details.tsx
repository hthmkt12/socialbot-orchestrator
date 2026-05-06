import { Image as ImageIcon } from 'lucide-react';
import RunStepErrorPanel from './RunStepErrorPanel';
import type { RunStep } from './run-monitor-types';

interface RunMonitorStepDetailsProps {
  step: RunStep;
}

function StepJsonSection({ title, value }: { title: string; value: Record<string, unknown> }) {
  if (Object.keys(value).length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function getScreenshotBase64(step: RunStep): string | null {
  const output = step.output_json;

  if (!output || typeof output !== 'object' || !('screenshotBase64' in output)) {
    return null;
  }

  const screenshot = output.screenshotBase64;
  return typeof screenshot === 'string' ? screenshot : null;
}

export function RunMonitorStepDetails({ step }: RunMonitorStepDetailsProps) {
  const screenshotBase64 = getScreenshotBase64(step);

  return (
    <div className="border-t border-gray-200 p-4 space-y-4">
      {step.input_json && <StepJsonSection title="Input" value={step.input_json} />}
      {step.output_json && <StepJsonSection title="Output" value={step.output_json} />}

      <RunStepErrorPanel error={step.error_json} showRaw />

      {screenshotBase64 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Screenshot
          </h4>
          <img
            src={`data:image/png;base64,${screenshotBase64}`}
            alt="Step screenshot"
            className="rounded-lg border border-gray-300 max-w-md"
          />
        </div>
      )}
    </div>
  );
}
