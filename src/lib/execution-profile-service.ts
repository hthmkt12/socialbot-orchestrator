import { logAudit } from './audit';
import { deleteAdminResource } from './admin-governance';
import type { ExecutionProfile, TargetFailurePolicy } from './database.types';
import { supabase } from './supabase';
import { isMissingSchemaError } from './supabase-errors';

export type ExecutionProfileInput = {
  name: string;
  description: string;
  concurrency_per_device: number;
  default_timeout_ms: number;
  max_retries: number;
  retry_base_delay_ms: number;
  retry_max_delay_ms: number;
  retry_max_elapsed_ms: number;
  target_failure_policy: TargetFailurePolicy;
  max_pilot_target_count: number;
  require_approval_for_adb: boolean;
  require_approval_for_autox: boolean;
};

function normalizeProfileInput(input: ExecutionProfileInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Execution profile name is required');
  if (!Number.isInteger(input.concurrency_per_device) || input.concurrency_per_device < 1) {
    throw new Error('Concurrency per device must be at least 1');
  }
  if (!Number.isInteger(input.default_timeout_ms) || input.default_timeout_ms < 1000) {
    throw new Error('Default timeout must be at least 1000ms');
  }
  if (!Number.isInteger(input.max_retries) || input.max_retries < 0) {
    throw new Error('Max retries must be 0 or greater');
  }
  if (input.max_retries > 10) {
    throw new Error('Max retries must be 10 or less');
  }
  if (!Number.isInteger(input.retry_base_delay_ms) || input.retry_base_delay_ms < 0) {
    throw new Error('Retry base delay must be 0 or greater');
  }
  if (!Number.isInteger(input.retry_max_delay_ms) || input.retry_max_delay_ms < input.retry_base_delay_ms) {
    throw new Error('Retry max delay must be greater than or equal to base delay');
  }
  if (!Number.isInteger(input.retry_max_elapsed_ms) || input.retry_max_elapsed_ms < 0) {
    throw new Error('Retry max elapsed must be 0 or greater');
  }
  if (input.retry_max_elapsed_ms > 3_600_000) {
    throw new Error('Retry max elapsed must be 3600000ms or less');
  }
  if (input.target_failure_policy !== 'fail_fast' && input.target_failure_policy !== 'skip_failed_target') {
    throw new Error('Target failure policy must be fail_fast or skip_failed_target');
  }
  if (!Number.isInteger(input.max_pilot_target_count) || input.max_pilot_target_count < 1) {
    throw new Error('Max pilot target count must be at least 1');
  }
  if (input.max_pilot_target_count > 10) {
    throw new Error('Max pilot target count must be 10 or less');
  }

  return {
    ...input,
    name,
    description: input.description.trim(),
  };
}

export async function fetchExecutionProfiles() {
  const { data, error } = await supabase
    .from('execution_profiles')
    .select('*')
    .order('name', { ascending: true });

  if (isMissingSchemaError(error)) return [];
  if (error) throw new Error(`Failed to fetch execution profiles: ${error.message}`);
  return data as ExecutionProfile[];
}

export async function createExecutionProfile(input: ExecutionProfileInput) {
  const normalized = normalizeProfileInput(input);
  const { data, error } = await supabase
    .from('execution_profiles')
    .insert(normalized)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to create execution profile: ${error.message}`);
  if (!data) throw new Error('Execution profile not created');

  await logAudit('execution_profile.create', 'execution_profile', data.id, { name: normalized.name });
  return data as ExecutionProfile;
}

export async function updateExecutionProfile(id: string, input: ExecutionProfileInput) {
  const normalized = normalizeProfileInput(input);
  const { data, error } = await supabase
    .from('execution_profiles')
    .update({ ...normalized, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update execution profile: ${error.message}`);
  if (!data) throw new Error('Execution profile not found');

  await logAudit('execution_profile.update', 'execution_profile', id, { name: normalized.name });
  return data as ExecutionProfile;
}

export async function deleteExecutionProfile(id: string) {
  await deleteAdminResource('execution_profile', id);
}
