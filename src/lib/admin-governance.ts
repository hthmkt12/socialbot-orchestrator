import { logAudit } from './audit';
import type { AuditLog, Profile, UserRole } from './database.types';
import {
  canDeleteAdminResources,
  canManageUsers,
  canViewAuditLogs,
  canViewAllAuditLogs,
  isUserRole,
} from './role-access';
import { supabase } from './supabase';

type CurrentProfile = Pick<Profile, 'user_id' | 'role'>;

export type AdminDeleteResourceType = 'device' | 'device_group' | 'macro' | 'execution_profile';

const ADMIN_DELETE_TABLES: Record<AdminDeleteResourceType, string> = {
  device: 'devices',
  device_group: 'device_groups',
  macro: 'macros',
  execution_profile: 'execution_profiles',
};

async function getCurrentProfile(): Promise<CurrentProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role')
    .maybeSingle();

  if (error) throw new Error(`Failed to get profile: ${error.message}`);
  if (!data) throw new Error('User profile not found');

  return { user_id: data.user_id, role: data.role as UserRole };
}

export async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!canManageUsers(profile.role)) {
    throw new Error('Only admins can manage users and roles');
  }

  return profile;
}

export function validateRoleUpdate(role: string): UserRole {
  if (!isUserRole(role)) {
    throw new Error(`Invalid user role: ${role}`);
  }

  return role;
}

async function fetchTargetProfile(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, email, role')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch target profile: ${error.message}`);
  if (!data) throw new Error('Target profile not found');

  return data as Pick<Profile, 'id' | 'user_id' | 'email' | 'role'>;
}

async function countAdminProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'ADMIN');

  if (error) throw new Error(`Failed to count admin profiles: ${error.message}`);
  return data?.length ?? 0;
}

export async function updateUserRole(profileId: string, nextRoleInput: string) {
  const actor = await requireAdminProfile();
  const nextRole = validateRoleUpdate(nextRoleInput);
  const target = await fetchTargetProfile(profileId);

  if (target.role === 'ADMIN' && nextRole !== 'ADMIN') {
    const adminCount = await countAdminProfiles();
    if (adminCount <= 1) {
      throw new Error('Cannot remove the last admin role');
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: nextRole, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update role: ${error.message}`);
  if (!data) throw new Error('Role update returned no profile');

  await logAudit('profile.role_update', 'profile', profileId, {
    actorUserId: actor.user_id,
    previousRole: target.role,
    nextRole,
  });

  return data as Profile;
}

export async function fetchProfilesForAdmin() {
  await requireAdminProfile();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, email, role, created_at, updated_at')
    .order('email', { ascending: true });

  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
  return data as Profile[];
}

export async function fetchAuditLogsForCurrentUser(limit = 100) {
  const profile = await getCurrentProfile();
  if (!canViewAuditLogs(profile.role)) {
    throw new Error('Only operators and admins can view audit logs');
  }

  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!canViewAllAuditLogs(profile.role)) {
    query = query.eq('actor_user_id', profile.user_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);
  return data as AuditLog[];
}

async function assertNoReference(table: string, column: string, resourceId: string, message: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq(column, resourceId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed dependency check: ${error.message}`);
  if (data) throw new Error(message);
}

export async function assertAdminDeleteAllowed(resourceType: AdminDeleteResourceType, resourceId: string) {
  if (resourceType === 'device') {
    await assertNoReference('workflow_schedules', 'target_device_id', resourceId, 'Cannot delete device referenced by a schedule');
    await assertNoReference('device_locks', 'device_id', resourceId, 'Cannot delete device with active locks');
    await assertNoReference('run_steps', 'device_id', resourceId, 'Cannot delete device referenced by run history');
  }

  if (resourceType === 'device_group') {
    await assertNoReference('workflow_schedules', 'target_group_id', resourceId, 'Cannot delete device group referenced by a schedule');
  }

  if (resourceType === 'macro') {
    await assertNoReference('workflow_schedules', 'macro_id', resourceId, 'Cannot delete macro referenced by a schedule');
  }

  if (resourceType === 'execution_profile') {
    await assertNoReference('workflow_runs', 'execution_profile_id', resourceId, 'Cannot delete execution profile referenced by a run');
  }
}

export async function deleteAdminResource(resourceType: AdminDeleteResourceType, resourceId: string) {
  const actor = await requireAdminProfile();
  if (!canDeleteAdminResources(actor.role)) {
    throw new Error('Only admins can delete admin-only resources');
  }

  await assertAdminDeleteAllowed(resourceType, resourceId);

  const { error } = await supabase
    .from(ADMIN_DELETE_TABLES[resourceType])
    .delete()
    .eq('id', resourceId);

  if (error) throw new Error(`Failed to delete ${resourceType}: ${error.message}`);

  await logAudit(`${resourceType}.admin_delete`, resourceType, resourceId, { actorUserId: actor.user_id });
}
