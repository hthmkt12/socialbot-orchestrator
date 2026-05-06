import { useState } from 'react';
import type { MacroDefinition } from '../../contracts/macro';
import type { GuidedBuilderStepType } from '../../lib/macro-builder';
import { MacroBuilderBasicsSection } from './MacroBuilderBasicsSection';
import { MacroBuilderInputsSection } from './MacroBuilderInputsSection';
import { MacroBuilderIntro } from './MacroBuilderIntro';
import { MacroBuilderStepsSection } from './MacroBuilderStepsSection';

interface Props {
  value: MacroDefinition;
  onChange: (next: MacroDefinition) => void;
}

export default function MacroDefinitionBuilderPanel({ value, onChange }: Props) {
  const [newStepType, setNewStepType] = useState<GuidedBuilderStepType>('launch_app');
  const inputEntries = Object.entries(value.inputs);

  return (
    <div className="space-y-6">
      <MacroBuilderIntro />
      <MacroBuilderBasicsSection value={value} onChange={onChange} />
      <MacroBuilderInputsSection inputEntries={inputEntries} value={value} onChange={onChange} />
      <MacroBuilderStepsSection
        newStepType={newStepType}
        value={value}
        onChange={onChange}
        onNewStepTypeChange={setNewStepType}
      />
    </div>
  );
}
