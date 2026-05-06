import type { MacroDefinition } from '../contracts/macro';
import type { Macro, MacroVersion } from '../lib/database.types';
import { supabase } from '../lib/supabase';

export async function fetchMacros(): Promise<Macro[]> {
  const { data, error } = await supabase
    .from('macros')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data as Macro[];
}

export async function fetchMacro(id: string): Promise<Macro | null> {
  const { data, error } = await supabase
    .from('macros')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Macro | null;
}

export async function fetchMacroVersions(macroId: string): Promise<MacroVersion[]> {
  const { data, error } = await supabase
    .from('macro_versions')
    .select('*')
    .eq('macro_id', macroId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return data as MacroVersion[];
}

export function buildMacroVersionInsert(definition: MacroDefinition) {
  return {
    definition_json: definition as unknown as Record<string, unknown>,
    input_schema_json: definition.inputs as unknown as Record<string, unknown>,
    tags_json: definition.meta.tags ?? [],
  };
}
