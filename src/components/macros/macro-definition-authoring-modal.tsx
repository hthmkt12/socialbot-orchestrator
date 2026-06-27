import type { MacroDefinition } from '../../contracts/macro';
import AiMacroPromptBox from './ai-macro-prompt-box';
import MacroDefinitionBuilderPanel from './macro-definition-builder-panel';
import {
  MacroDefinitionAuthoringActions,
  MacroDefinitionAuthoringModeToggle,
  MacroDefinitionJsonEditor,
  MacroDefinitionValidationErrors,
} from './macro-definition-authoring-sections';
import MacroStarterTemplatePicker from './macro-starter-template-picker';
import { useMacroDefinitionAuthoringState } from './use-macro-definition-authoring-state';
import Modal from '../ui/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  initialDefinition: MacroDefinition;
  isSubmitting?: boolean;
  showStarterTemplates?: boolean;
  onSubmit: (definition: MacroDefinition) => Promise<void>;
}

export default function MacroDefinitionAuthoringModal({
  open,
  onClose,
  title,
  submitLabel,
  initialDefinition,
  isSubmitting = false,
  showStarterTemplates = false,
  onSubmit,
}: Props) {
  const {
    builderDefinition,
    currentCompatibility,
    errors,
    handleAiGenerated,
    handleJsonChange,
    handleModeChange,
    handleSubmit,
    handleTemplateApply,
    json,
    mode,
    selectedTemplateKey,
    setBuilderDefinition,
    starterTemplates,
  } = useMacroDefinitionAuthoringState({
    initialDefinition,
    onSubmit,
    open,
    showStarterTemplates,
  });

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <MacroStarterTemplatePicker
          templates={starterTemplates}
          selectedTemplateKey={selectedTemplateKey}
          onApply={(template) => {
            handleTemplateApply(template.definition, template.key);
          }}
        />

        <AiMacroPromptBox
          existingMacro={builderDefinition}
          onGenerated={handleAiGenerated}
        />

        <MacroDefinitionAuthoringModeToggle mode={mode} onChange={handleModeChange} />

        {mode === 'builder' ? (
          <MacroDefinitionBuilderPanel value={builderDefinition} onChange={setBuilderDefinition} />
        ) : (
          <MacroDefinitionJsonEditor
            compatibility={currentCompatibility}
            json={json}
            onChange={handleJsonChange}
          />
        )}

        <MacroDefinitionValidationErrors errors={errors} />

        <MacroDefinitionAuthoringActions
          isSubmitting={isSubmitting}
          onClose={onClose}
          submitLabel={submitLabel}
        />
      </form>
    </Modal>
  );
}
