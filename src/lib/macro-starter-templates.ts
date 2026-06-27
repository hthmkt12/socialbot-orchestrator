import { SAMPLE_MACROS, type MacroDefinition } from '../contracts/macro';
import { SOCIAL_TEMPLATES } from '../contracts/social-engagement-templates';
import {
  analyzeMacroDefinitionForGuidedBuilder,
  cloneMacroDefinition,
} from './macro-builder';

export interface MacroStarterTemplate {
  key: string;
  name: string;
  description: string;
  tags: string[];
  targetMode: MacroDefinition['target']['mode'];
  stepCount: number;
  opensIn: 'builder' | 'json';
  opensInLabel: string;
  opensInReason: string;
  definition: MacroDefinition;
}

const STARTER_TEMPLATE_CONFIG = [
  {
    key: 'launch_app_and_capture',
    description: 'Launch an app, wait briefly, capture evidence, and confirm the active package.',
  },
  {
    key: 'simple_form_fill_demo',
    description: 'Open an app, fill two fields, and keep a screenshot for QA review.',
  },
  {
    key: 'open_and_swipe_feed',
    description: 'Launch an app, swipe through a feed, and capture the resulting state.',
  },
  {
    key: 'multi_device_launch_check',
    description: 'Run the same launch-and-capture smoke check across multiple devices.',
  },
  {
    key: 'settings_smoke_test',
    description: 'Open Settings and verify the foreground package with a guard clause.',
  },
] as const;

function summarizeTemplateFallback(reasons: string[]): string {
  if (reasons.some((reason) => reason.includes('"conditional"') || reason.includes('THEN branch') || reason.includes('ELSE branch'))) {
    return 'Opens in Raw JSON because this template uses conditional logic.';
  }

  if (reasons.some((reason) => reason.includes('"group"') || reason.includes('nested grouped steps'))) {
    return 'Opens in Raw JSON because this template uses grouped steps.';
  }

  if (reasons.some((reason) => reason.includes('"adb"') || reason.includes('"run_autox"'))) {
    return 'Opens in Raw JSON because this template uses privileged advanced step types.';
  }

  return 'Opens in Raw JSON because this template uses advanced macro structure.';
}

export function getStarterMacroTemplates(): MacroStarterTemplate[] {
  const generic = STARTER_TEMPLATE_CONFIG.flatMap((templateConfig) => {
    const definition = SAMPLE_MACROS.find((macro) => macro.meta.key === templateConfig.key);
    if (!definition) return [];

    const clonedDefinition = cloneMacroDefinition(definition);
    const compatibility = analyzeMacroDefinitionForGuidedBuilder(clonedDefinition);

    return [{
      key: clonedDefinition.meta.key,
      name: clonedDefinition.meta.name,
      description: templateConfig.description,
      tags: clonedDefinition.meta.tags ?? [],
      targetMode: clonedDefinition.target.mode,
      stepCount: clonedDefinition.steps.length,
      opensIn: compatibility.supported ? 'builder' : 'json',
      opensInLabel: compatibility.supported ? 'Guided Builder' : 'Raw JSON',
      opensInReason: compatibility.supported
        ? 'Opens directly in Guided Builder.'
        : summarizeTemplateFallback(compatibility.reasons),
      definition: clonedDefinition,
    }];
  });

  const social = Object.values(SOCIAL_TEMPLATES).map((template) => {
    const def: MacroDefinition = { ...template.definition, antiDetection: template.antiDetection };
    return {
      key: def.meta.key,
      name: def.meta.name,
      description: def.meta.description ?? '',
      tags: [...(def.meta.tags ?? []), template.platform],
      targetMode: def.target.mode,
      stepCount: def.steps.length,
      opensIn: 'json' as const,
      opensInLabel: 'Raw JSON',
      opensInReason: 'Social engagement template with anti-detection config.',
      definition: def,
    };
  });

  return [...generic, ...social];
}
