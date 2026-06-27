import { useEffect, useState } from 'react';
import type { MacroDefinition } from '../../contracts/macro';
import { validateMacroDefinition } from '../../contracts/macro';
import {
  analyzeMacroDefinitionForGuidedBuilder,
  cloneMacroDefinition,
} from '../../lib/macro-builder';
import { getStarterMacroTemplates } from '../../lib/macro-starter-templates';

type AuthoringMode = 'builder' | 'json';

interface UseMacroDefinitionAuthoringStateArgs {
  initialDefinition: MacroDefinition;
  onSubmit: (definition: MacroDefinition) => Promise<void>;
  open: boolean;
  showStarterTemplates: boolean;
}

export function useMacroDefinitionAuthoringState({
  initialDefinition,
  onSubmit,
  open,
  showStarterTemplates,
}: UseMacroDefinitionAuthoringStateArgs) {
  const [mode, setMode] = useState<AuthoringMode>('builder');
  const [builderDefinition, setBuilderDefinition] = useState<MacroDefinition>(cloneMacroDefinition(initialDefinition));
  const [json, setJson] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);

  const starterTemplates = showStarterTemplates ? getStarterMacroTemplates() : [];

  const loadDefinition = (definition: MacroDefinition) => {
    const seed = cloneMacroDefinition(definition);
    const compatibility = analyzeMacroDefinitionForGuidedBuilder(seed);
    setBuilderDefinition(seed);
    setJson(JSON.stringify(seed, null, 2));
    setMode(compatibility.supported ? 'builder' : 'json');
    setErrors([]);
  };

  useEffect(() => {
    if (!open) return;
    setSelectedTemplateKey(null);
    loadDefinition(initialDefinition);
  }, [open, initialDefinition]);

  const handleModeChange = (nextMode: AuthoringMode) => {
    if (nextMode === mode) return;

    if (nextMode === 'json') {
      setJson(JSON.stringify(builderDefinition, null, 2));
      setMode('json');
      setErrors([]);
      return;
    }

    try {
      const parsed = JSON.parse(json);
      const validation = validateMacroDefinition(parsed);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      const nextDefinition = cloneMacroDefinition(parsed as MacroDefinition);
      const compatibility = analyzeMacroDefinitionForGuidedBuilder(nextDefinition);
      if (!compatibility.supported) {
        setErrors([
          'Guided Builder only supports flat common-step workflows.',
          ...compatibility.reasons,
        ]);
        return;
      }

      setBuilderDefinition(nextDefinition);
      setMode('builder');
      setErrors([]);
    } catch {
      setErrors(['Invalid JSON']);
    }
  };

  const handleJsonChange = (value: string) => {
    setJson(value);
    setErrors([]);
  };

  const handleTemplateApply = (definition: MacroDefinition, templateKey: string) => {
    loadDefinition(definition);
    setSelectedTemplateKey(templateKey);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === 'builder') {
      const validation = validateMacroDefinition(builderDefinition);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }
      await onSubmit(builderDefinition);
      return;
    }

    try {
      const parsed = JSON.parse(json);
      const validation = validateMacroDefinition(parsed);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }
      await onSubmit(parsed as MacroDefinition);
    } catch {
      setErrors(['Invalid JSON']);
    }
  };

  const handleAiGenerated = (macro: MacroDefinition) => {
    const validation = validateMacroDefinition(macro);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    loadDefinition(macro);
  };

  return {
    builderDefinition,
    currentCompatibility: analyzeMacroDefinitionForGuidedBuilder(builderDefinition),
    errors,
    handleAiGenerated,
    handleJsonChange,
    handleModeChange,
    handleSubmit,
    handleTemplateApply,
    mode,
    selectedTemplateKey,
    setBuilderDefinition,
    starterTemplates,
    json,
  };
}
