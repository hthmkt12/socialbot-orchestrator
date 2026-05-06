import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MacroDefinitionAuthoringModal from '../components/macros/macro-definition-authoring-modal';
import { MacroDetailAboutPanel } from '../components/macros/MacroDetailAboutPanel';
import { MacroDetailConfigPanel } from '../components/macros/MacroDetailConfigPanel';
import { MacroDetailHeader } from '../components/macros/MacroDetailHeader';
import { MacroDetailInputsPanel } from '../components/macros/MacroDetailInputsPanel';
import { MacroDetailJsonModal } from '../components/macros/MacroDetailJsonModal';
import { MacroDetailStepsPanel } from '../components/macros/MacroDetailStepsPanel';
import { MacroDetailVersionsPanel } from '../components/macros/MacroDetailVersionsPanel';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import { useActivateMacroVersion, useCreateMacroVersion, useMacro, useMacroVersions } from '../hooks/useMacros';
import { type MacroDefinition } from '../contracts/macro';
import { createEmptyMacroDefinition } from '../lib/macro-builder';
import { canManageMacros, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

export default function MacroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: macro, isLoading: macroLoading } = useMacro(id ?? '');
  const { data: versions, isLoading: versionsLoading } = useMacroVersions(id ?? '');
  const activateVersion = useActivateMacroVersion();
  const createVersion = useCreateMacroVersion();
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const [showCreate, setShowCreate] = useState(false);
  const [viewJson, setViewJson] = useState<Record<string, unknown> | null>(null);
  const canEditMacros = canManageMacros(profile?.role);

  if (macroLoading) {
    return <div className="flex items-center justify-center flex-1"><Spinner size="lg" /></div>;
  }

  if (!macro) {
    return <div className="flex items-center justify-center flex-1 text-gray-500">Macro not found</div>;
  }

  const handleActivate = async (versionId: string) => {
    if (!canEditMacros) {
      addToast('Only operators and admins can activate macro versions', 'error');
      return;
    }
    try {
      await activateVersion.mutateAsync({ versionId, macroId: macro.id });
      addToast('Version activated', 'success');
    } catch {
      addToast('Failed to activate version', 'error');
    }
  };

  const activeVersion = versions?.find((version) => version.status === 'ACTIVE');
  const activeDefinition = activeVersion?.definition_json as unknown as MacroDefinition | undefined;
  const activeTags = ((activeVersion?.tags_json as string[]) ?? []);

  return (
    <>
      <MacroDetailHeader
        canEditMacros={canEditMacros}
        macroKey={macro.key}
        macroName={macro.name}
        onBack={() => navigate('/macros')}
        onNewVersion={() => {
          if (!canEditMacros) return;
          setShowCreate(true);
        }}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {!canEditMacros && (
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role is read-only for macro changes`}
              detail="You can inspect definitions, input schema, and version history, but only operators and admins can create or activate macro versions."
            />
          )}
          <MacroDetailAboutPanel description={macro.description} tags={activeTags} />
          {activeDefinition && <MacroDetailConfigPanel definition={activeDefinition} />}
          {activeDefinition?.inputs && <MacroDetailInputsPanel inputs={activeDefinition.inputs} />}
          {activeDefinition?.steps && <MacroDetailStepsPanel steps={activeDefinition.steps} />}
          <MacroDetailVersionsPanel
            activatePending={activateVersion.isPending}
            canEditMacros={canEditMacros}
            versions={versions}
            versionsLoading={versionsLoading}
            onActivate={handleActivate}
            onViewJson={setViewJson}
          />
        </div>
      </div>

      {canEditMacros && profile && (
        <MacroDefinitionAuthoringModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="New Macro Version"
          submitLabel="Create Version"
          initialDefinition={activeDefinition ? activeDefinition : createEmptyMacroDefinition()}
          isSubmitting={createVersion.isPending}
          onSubmit={async (definition) => {
            try {
              await createVersion.mutateAsync({
                macroId: macro.id,
                definition,
                profileId: profile.id,
              });
              addToast('Version created', 'success');
              setShowCreate(false);
            } catch {
              addToast('Failed to create version', 'error');
            }
          }}
        />
      )}

      <MacroDetailJsonModal definition={viewJson} onClose={() => setViewJson(null)} />
    </>
  );
}
