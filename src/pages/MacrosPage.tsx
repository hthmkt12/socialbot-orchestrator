import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import MacroDefinitionAuthoringModal from '../components/macros/macro-definition-authoring-modal';
import { MacrosGrid } from '../components/macros/MacrosGrid';
import { MacrosPageHeaderActions } from '../components/macros/MacrosPageHeaderActions';
import { MacrosSearchBar } from '../components/macros/MacrosSearchBar';
import { SeedMacrosModal } from '../components/macros/SeedMacrosModal';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { useCreateMacro, useMacros } from '../hooks/useMacros';
import { createEmptyMacroDefinition } from '../lib/macro-builder';
import { canManageMacros, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

export default function MacrosPage() {
  const { data: macros, isLoading } = useMacros();
  const createMacro = useCreateMacro();
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const [showCreate, setShowCreate] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const canEditMacros = canManageMacros(profile?.role);
  const emptyMacroDefinition = useMemo(() => createEmptyMacroDefinition(), []);
  const filtered = useMemo(() => {
    if (!macros) return [];
    if (!search) return macros;
    const q = search.toLowerCase();
    return macros.filter(
      (macro) =>
        macro.name.toLowerCase().includes(q) ||
        macro.key.toLowerCase().includes(q) ||
        (macro.description ?? '').toLowerCase().includes(q)
    );
  }, [macros, search]);

  return (
    <>
      <Header
        title="Macros"
        subtitle={`${macros?.length ?? 0} automation workflows`}
        actions={
          <MacrosPageHeaderActions
            canEditMacros={canEditMacros}
            onCreate={() => {
              if (!canEditMacros) return;
              setShowCreate(true);
            }}
            onSeed={() => {
              if (!canEditMacros) return;
              setShowSeed(true);
            }}
          />
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canEditMacros && (
          <div className="mb-5">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role is read-only for macros`}
              detail="You can inspect macro definitions and versions, but only operators and admins can create macros, seed samples, or publish new versions."
            />
          </div>
        )}
        <MacrosSearchBar resultCount={filtered.length} search={search} onSearchChange={setSearch} />
        <MacrosGrid
          filtered={filtered}
          isLoading={isLoading}
          macros={macros}
          onOpenMacro={(macroId) => navigate(`/macros/${macroId}`)}
        />
      </div>

      {canEditMacros && profile && (
        <MacroDefinitionAuthoringModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Create Macro"
          submitLabel="Create Macro"
          initialDefinition={emptyMacroDefinition}
          isSubmitting={createMacro.isPending}
          showStarterTemplates
          onSubmit={async (definition) => {
            try {
              await createMacro.mutateAsync({
                definition,
                profileId: profile.id,
              });
              addToast('Macro created', 'success');
              setShowCreate(false);
            } catch {
              addToast('Failed to create macro', 'error');
            }
          }}
        />
      )}
      {canEditMacros && <SeedMacrosModal open={showSeed} onClose={() => setShowSeed(false)} />}
    </>
  );
}
