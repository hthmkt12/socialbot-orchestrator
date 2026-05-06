import type { MacroDefinition } from '../contracts/macro';
import { logAudit } from '../lib/audit';
import type { Macro } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { buildMacroVersionInsert } from './macro-query-helpers';

export async function createMacroRequest({
  definition,
  profileId,
}: {
  definition: MacroDefinition;
  profileId: string;
}): Promise<Macro> {
  const { data: macro, error: macroErr } = await supabase
    .from('macros')
    .insert({
      key: definition.meta.key,
      name: definition.meta.name,
      description: definition.meta.description ?? '',
      created_by_user_id: profileId,
    })
    .select()
    .maybeSingle();
  if (macroErr) throw macroErr;
  if (!macro) throw new Error('Macro insert returned no data');

  const { data: version, error: versionErr } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macro.id,
      version_number: 1,
      status: 'ACTIVE',
      created_by_user_id: profileId,
      ...buildMacroVersionInsert(definition),
    })
    .select()
    .maybeSingle();
  if (versionErr) throw versionErr;
  if (!version) throw new Error('Macro version insert returned no data');

  await supabase
    .from('macros')
    .update({ latest_version_id: version.id })
    .eq('id', macro.id);

  await logAudit('macro.create', 'macro', macro.id, { key: definition.meta.key });
  return macro as Macro;
}

export async function createMacroVersionRequest({
  macroId,
  definition,
  profileId,
}: {
  macroId: string;
  definition: MacroDefinition;
  profileId: string;
}) {
  const { data: versions } = await supabase
    .from('macro_versions')
    .select('version_number')
    .eq('macro_id', macroId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;
  const { data: version, error } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: nextVersion,
      status: 'DRAFT',
      created_by_user_id: profileId,
      ...buildMacroVersionInsert(definition),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!version) throw new Error('Macro version insert returned no data');

  await logAudit('macro_version.create', 'macro_version', version.id, {
    macroId,
    version: nextVersion,
  });
  return version;
}

export async function activateMacroVersionRequest({
  macroId,
  versionId,
}: {
  macroId: string;
  versionId: string;
}) {
  await supabase
    .from('macro_versions')
    .update({ status: 'ARCHIVED' })
    .eq('macro_id', macroId)
    .eq('status', 'ACTIVE');

  await supabase
    .from('macro_versions')
    .update({ status: 'ACTIVE' })
    .eq('id', versionId);

  await supabase
    .from('macros')
    .update({ latest_version_id: versionId })
    .eq('id', macroId);

  await logAudit('macro_version.activate', 'macro_version', versionId, { macroId });
}
