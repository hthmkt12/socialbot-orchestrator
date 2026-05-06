import type { MacroInputField } from '../../contracts/macro';

export interface RunWizardInputField extends MacroInputField {
  key: string;
}

export function RunWizardInputsStep({
  inputFields,
  inputValues,
  onInputValuesChange,
}: {
  inputFields: RunWizardInputField[];
  inputValues: Record<string, string>;
  onInputValuesChange: (inputValues: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Configure the input variables required by this macro.</p>
      {inputFields.map((field) => {
        const value = inputValues[field.key] ?? '';
        const isEmpty = field.required && !value;
        return (
          <div key={field.key}>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {field.key}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
              {!field.required && <span className="text-gray-400 text-[10px] ml-1">(optional)</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-2">{field.description}</p>
            )}
            {field.type === 'boolean' ? (
              <label className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                isEmpty ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
              }`}>
                <input
                  type="checkbox"
                  checked={value === 'true'}
                  onChange={(event) => {
                    onInputValuesChange({
                      ...inputValues,
                      [field.key]: event.target.checked ? 'true' : 'false',
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500"
                  required={field.required}
                />
                <span className="text-sm text-gray-700">
                  {value === 'true' ? 'True' : 'False'}
                </span>
              </label>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(event) => {
                  onInputValuesChange({ ...inputValues, [field.key]: event.target.value });
                }}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all ${
                  isEmpty ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder={`Enter ${field.key}...`}
                required={field.required}
              />
            )}
            {isEmpty && (
              <p className="text-xs text-red-600 mt-1">This field is required</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
