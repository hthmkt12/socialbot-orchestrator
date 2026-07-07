import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./audit', () => ({
  logAudit: vi.fn(),
}));

import { logAudit } from './audit';
import {
  deleteAdminResource,
  fetchAuditLogsForCurrentUser,
  updateUserRole,
  validateRoleUpdate,
} from './admin-governance';
import { supabase } from './supabase';

const mockFrom = vi.mocked(supabase.from) as Mock;
const mockLogAudit = vi.mocked(logAudit) as Mock;

function thenable<T>(value: T, methods: Record<string, unknown> = {}) {
  return {
    ...methods,
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
  };
}

function profileTable(role: string, userId = 'admin-user') {
  return {
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: userId, role },
        error: null,
      }),
    }),
  };
}

function targetProfileTable({
  targetRole = 'VIEWER',
  updatedRole = 'OPERATOR',
  adminCount = 2,
}: {
  targetRole?: string;
  updatedRole?: string;
  adminCount?: number;
}) {
  const maybeSingle = vi.fn()
    .mockResolvedValueOnce({
      data: { id: 'profile-2', user_id: 'user-2', email: 'user@example.com', role: targetRole },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { id: 'profile-2', user_id: 'user-2', email: 'user@example.com', role: updatedRole },
      error: null,
    });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockImplementation(() => ({
    eq,
    maybeSingle: vi.fn().mockResolvedValue({
      data: { user_id: 'admin-user', role: 'ADMIN' },
      error: null,
    }),
  }));
  const adminCountEq = vi.fn().mockReturnValue(thenable({
    data: Array.from({ length: adminCount }, (_, index) => ({ id: `admin-${index}` })),
    error: null,
  }));
  select.mockReturnValueOnce({
    maybeSingle: vi.fn().mockResolvedValue({
      data: { user_id: 'admin-user', role: 'ADMIN' },
      error: null,
    }),
  });
  select.mockReturnValueOnce({ eq });
  select.mockReturnValueOnce({ eq: adminCountEq });

  const updateSelect = vi.fn().mockReturnValue({ maybeSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  return { select, update, updateEq, adminCountEq };
}

function auditTable() {
  const eq = vi.fn().mockReturnValue(thenable({ data: [{ id: 'own-log' }], error: null }));
  const limit = vi.fn().mockReturnValue(thenable({ data: [{ id: 'all-log' }], error: null }, { eq }));
  const order = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ order });
  return { select, eq, limit };
}

function dependencyTable(hasReference: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: hasReference ? { id: 'ref-1' } : null,
    error: null,
  });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq };
}

function deleteTable() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockReturnValue({ eq });
  return { delete: remove, eq };
}

describe('admin governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AD-ERR-001 rejects invalid role updates', () => {
    expect(() => validateRoleUpdate('OWNER')).toThrow('Invalid user role: OWNER');
  });

  it('OP-NO-001 blocks operators from updating user roles', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('OPERATOR');
      return {};
    });

    await expect(updateUserRole('profile-2', 'ADMIN')).rejects.toThrow('Only admins can manage users and roles');
  });

  it('AD-ERR-001 prevents removing the last admin role', async () => {
    const profiles = targetProfileTable({ targetRole: 'ADMIN', updatedRole: 'OPERATOR', adminCount: 1 });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profiles;
      return {};
    });

    await expect(updateUserRole('profile-2', 'OPERATOR')).rejects.toThrow('Cannot remove the last admin role');
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it('AD-CAN-004 updates a user role and writes an audit entry', async () => {
    const profiles = targetProfileTable({ targetRole: 'VIEWER', updatedRole: 'OPERATOR' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profiles;
      return {};
    });

    await expect(updateUserRole('profile-2', 'OPERATOR')).resolves.toMatchObject({ role: 'OPERATOR' });
    expect(profiles.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'OPERATOR' }));
    expect(mockLogAudit).toHaveBeenCalledWith('profile.role_update', 'profile', 'profile-2', expect.objectContaining({
      previousRole: 'VIEWER',
      nextRole: 'OPERATOR',
    }));
  });

  it('AD-CAN-002 lets admins fetch all audit logs without actor filtering', async () => {
    const audit = auditTable();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('ADMIN');
      if (table === 'audit_logs') return audit;
      return {};
    });

    await expect(fetchAuditLogsForCurrentUser(50)).resolves.toEqual([{ id: 'all-log' }]);
    expect(audit.limit).toHaveBeenCalledWith(50);
    expect(audit.eq).not.toHaveBeenCalled();
  });

  it('OP-NO-003 limits operators to their own audit events', async () => {
    const audit = auditTable();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('OPERATOR', 'operator-user');
      if (table === 'audit_logs') return audit;
      return {};
    });

    await expect(fetchAuditLogsForCurrentUser(25)).resolves.toEqual([{ id: 'own-log' }]);
    expect(audit.eq).toHaveBeenCalledWith('actor_user_id', 'operator-user');
  });

  it('AD-ERR-002 blocks deleting a device referenced by a schedule', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('ADMIN');
      if (table === 'workflow_schedules') return dependencyTable(true);
      return dependencyTable(false);
    });

    await expect(deleteAdminResource('device', 'device-1')).rejects.toThrow('Cannot delete device referenced by a schedule');
  });

  it.each([
    ['device', 'devices'],
    ['device_group', 'device_groups'],
    ['macro', 'macros'],
    ['execution_profile', 'execution_profiles'],
  ] as const)('AD-CAN-006 deletes admin-only %s resources after dependency checks pass', async (resourceType, tableName) => {
    const resourceTable = deleteTable();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileTable('ADMIN');
      if (table === tableName) return resourceTable;
      return dependencyTable(false);
    });

    await expect(deleteAdminResource(resourceType, 'resource-1')).resolves.toBeUndefined();
    expect(resourceTable.delete).toHaveBeenCalled();
    expect(resourceTable.eq).toHaveBeenCalledWith('id', 'resource-1');
    expect(mockLogAudit).toHaveBeenCalledWith(`${resourceType}.admin_delete`, resourceType, 'resource-1', {
      actorUserId: 'admin-user',
    });
  });
});
