import { describe, expect, it } from 'vitest';
import {
  ROLE_PERMISSIONS,
  canManageAccounts,
  canManageApprovals,
  canDeleteAdminResources,
  canManageDevices,
  canManageDeviceLocks,
  canManageMacros,
  canManageRuns,
  canManageSchedules,
  canManageUsers,
  canCreateReadinessReports,
  canReviewReadinessReports,
  canViewAllAuditLogs,
  canViewAuditLogs,
  checkPermission,
  getRoleLabel,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isKnownActorRole,
  isUserRole,
  isViewerRole,
} from './role-access';

describe('role access foundation', () => {
  it('keeps visitor unauthenticated and public-only', () => {
    expect(hasPermission('VISITOR', 'public.auth.access')).toBe(true);
    expect(hasPermission('VISITOR', 'app.read')).toBe(false);
    expect(checkPermission(null, 'app.read')).toEqual({
      allowed: false,
      role: null,
      permission: 'app.read',
      reason: 'missing-role',
    });
  });

  it('keeps viewer read-only across authenticated app surfaces', () => {
    expect(hasAllPermissions('VIEWER', ['app.read', 'devices.read', 'macros.read', 'runs.read'])).toBe(true);
    expect(hasAnyPermission('VIEWER', ['runs.manage', 'macros.manage', 'approvals.resolve'])).toBe(false);
    expect(canManageRuns('VIEWER')).toBe(false);
    expect(canManageMacros('VIEWER')).toBe(false);
    expect(canManageApprovals('VIEWER')).toBe(false);
    expect(canManageAccounts('VIEWER')).toBe(false);
    expect(canManageDevices('VIEWER')).toBe(false);
    expect(canManageSchedules('VIEWER')).toBe(false);
    expect(canViewAuditLogs('VIEWER')).toBe(false);
    expect(canCreateReadinessReports('VIEWER')).toBe(false);
    expect(canReviewReadinessReports('VIEWER')).toBe(false);
    expect(isViewerRole('VIEWER')).toBe(true);
  });

  it('allows operators to run operations without admin governance permissions', () => {
    expect(canManageRuns('OPERATOR')).toBe(true);
    expect(canManageMacros('OPERATOR')).toBe(true);
    expect(canManageApprovals('OPERATOR')).toBe(true);
    expect(canManageAccounts('OPERATOR')).toBe(true);
    expect(canManageDevices('OPERATOR')).toBe(true);
    expect(canManageSchedules('OPERATOR')).toBe(true);
    expect(canManageDeviceLocks('OPERATOR')).toBe(true);
    expect(canViewAuditLogs('OPERATOR')).toBe(true);
    expect(canCreateReadinessReports('OPERATOR')).toBe(true);
    expect(canReviewReadinessReports('OPERATOR')).toBe(false);
    expect(canViewAllAuditLogs('OPERATOR')).toBe(false);
    expect(canManageUsers('OPERATOR')).toBe(false);
    expect(canDeleteAdminResources('OPERATOR')).toBe(false);
  });

  it('grants admins governance permissions on top of operator access', () => {
    expect(hasPermission('ADMIN', 'roles.manage')).toBe(true);
    expect(hasPermission('ADMIN', 'execution_profiles.manage')).toBe(true);
    expect(canManageUsers('ADMIN')).toBe(true);
    expect(canManageDevices('ADMIN')).toBe(true);
    expect(canViewAllAuditLogs('ADMIN')).toBe(true);
    expect(canManageRuns('ADMIN')).toBe(true);
    expect(canDeleteAdminResources('ADMIN')).toBe(true);
    expect(canCreateReadinessReports('ADMIN')).toBe(true);
    expect(canReviewReadinessReports('ADMIN')).toBe(true);
  });

  it('keeps system actors narrowly scoped', () => {
    expect(hasAllPermissions('SYSTEM_WORKER', ['worker.claim_runs', 'worker.write_artifacts', 'worker.write_audit_logs'])).toBe(true);
    expect(hasPermission('SYSTEM_WORKER', 'roles.manage')).toBe(false);
    expect(hasPermission('MOBILE_MCP_BRIDGE', 'bridge.execute_device_action')).toBe(true);
    expect(hasPermission('MOBILE_MCP_BRIDGE', 'runs.manage')).toBe(false);
    expect(hasPermission('SCHEDULER', 'scheduler.trigger_runs')).toBe(true);
    expect(hasPermission('SCHEDULER', 'accounts.manage')).toBe(false);
  });

  it('exposes role labels and role type guards for callers', () => {
    expect(getRoleLabel('ADMIN')).toBe('Admin');
    expect(getRoleLabel(null)).toBe('Unknown');
    expect(isUserRole('OPERATOR')).toBe(true);
    expect(isUserRole('SYSTEM_WORKER')).toBe(false);
    expect(isKnownActorRole('SYSTEM_WORKER')).toBe(true);
    expect(isKnownActorRole('UNKNOWN')).toBe(false);
    expect(Object.keys(ROLE_PERMISSIONS)).toEqual([
      'VISITOR',
      'VIEWER',
      'OPERATOR',
      'ADMIN',
      'SYSTEM_WORKER',
      'MOBILE_MCP_BRIDGE',
      'SCHEDULER',
    ]);
  });
});
