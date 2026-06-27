import type { MacroDefinition } from '../contracts/macro';
import { supabase } from './supabase';

export interface AiMacroGenerateRequest {
  prompt: string;
  existingMacro?: MacroDefinition;
}

export interface AiMacroGenerateResponse {
  macro: MacroDefinition;
}

export interface AiMacroGenerateError {
  error: string;
}

/**
 * Calls the ai-macro-generator Supabase Edge Function to translate
 * a natural language prompt into a MacroDefinition JSON.
 */
export async function generateMacroFromPrompt(
  request: AiMacroGenerateRequest,
): Promise<AiMacroGenerateResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('ai-macro-generator', {
    body: {
      prompt: request.prompt,
      existingMacro: request.existingMacro,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to generate macro');
  }

  const response = data as AiMacroGenerateResponse | AiMacroGenerateError;

  if ('error' in response) {
    throw new Error(response.error);
  }

  return response;
}
