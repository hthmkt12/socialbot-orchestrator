import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import { useAdminProfiles, useUpdateUserRole } from '../hooks/use-admin-users';
import type { Profile, UserRole } from '../lib/database.types';
import { canManageUsers, getRoleLabel, USER_ROLES } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

export default function AdminUsersPage() {
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const canManage = canManageUsers(profile?.role);
  const { data: profiles, isLoading, isError } = useAdminProfiles(canManage);
  const updateRole = useUpdateUserRole();

  const handleRoleChange = async (target: Profile, role: UserRole) => {
    if (!canManage) {
      addToast('Only admins can manage users and roles', 'error');
      return;
    }

    try {
      await updateRole.mutateAsync({ profileId: target.id, role });
      addToast('User role updated', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user role';
      addToast(message, 'error');
    }
  };

  return (
    <>
      <Header
        title="User Roles"
        subtitle="Admin-only profile and role management"
      />

      <div className="flex-1 overflow-auto p-6">
        {!canManage ? (
          <RoleAccessNotice
            title={`${getRoleLabel(profile?.role)} role cannot manage users`}
            detail="Only admins can inspect all workspace profiles and change user roles."
            tone="warning"
          />
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Spinner size="lg" /></div>
        ) : isError ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">Failed to load user profiles.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_190px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>User</span>
              <span>Current Role</span>
              <span>Change Role</span>
            </div>
            <div className="divide-y divide-gray-100">
              {(profiles ?? []).map((userProfile) => (
                <div key={userProfile.id} className="grid grid-cols-[minmax(0,1fr)_150px_190px] gap-4 px-5 py-4 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{userProfile.email}</p>
                    <p className="text-xs text-gray-500 truncate">{userProfile.user_id}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{userProfile.role}</span>
                  <select
                    value={userProfile.role}
                    onChange={(event) => void handleRoleChange(userProfile, event.target.value as UserRole)}
                    disabled={updateRole.isPending}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
