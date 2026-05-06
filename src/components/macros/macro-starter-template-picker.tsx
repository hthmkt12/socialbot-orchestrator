import type { MacroStarterTemplate } from '../../lib/macro-starter-templates';

interface Props {
  templates: MacroStarterTemplate[];
  selectedTemplateKey: string | null;
  onApply: (template: MacroStarterTemplate) => void;
}

export default function MacroStarterTemplatePicker({
  templates,
  selectedTemplateKey,
  onApply,
}: Props) {
  if (templates.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Start From Template</h4>
        <p className="text-xs text-gray-500 mt-1">
          Pick a starter workflow. Guided-compatible templates open in the builder; advanced templates open in Raw JSON.
        </p>
        <p className="text-xs text-amber-700 mt-2">
          Applying a template replaces the current draft in this modal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map((template) => {
          const selected = selectedTemplateKey === template.key;
          return (
            <button
              key={template.key}
              type="button"
              onClick={() => onApply(template)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? 'border-sky-300 bg-sky-50'
                  : 'border-gray-200 hover:border-sky-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900">{template.name}</h5>
                  <p className="text-xs text-gray-500 font-mono mt-1">{template.key}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  template.opensIn === 'builder'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {template.opensInLabel}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-3">{template.description}</p>
              <p className="text-xs text-gray-500 mt-3">
                {template.targetMode.replace(/_/g, ' ')} · {template.stepCount} step{template.stepCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 mt-2">{template.opensInReason}</p>

              {template.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <span key={tag} className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
