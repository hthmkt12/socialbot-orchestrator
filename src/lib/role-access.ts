import type { UserRole } from './database.types';

export const USER_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const satisfies readonly UserRole[];
export const SYSTEM_ACTOR_ROLES = ['SYSTEM_WORKER', 'MOBILE_MCP_BRIDGE', 'SCHEDULER'] as const;

export type SystemActorRole = (typeof SYSTEM_ACTOR_ROLES)[number];
export type ActorRole = UserRole | 'VISITOR' | SystemActorRole;

export type Permission =
  | 'public.auth.access'
  | 'app.read'
  | 'dashboard.read'
  | 'devices.read'
  | 'devices.manage'
  | 'devices.locks.manage'
  | 'device_groups.read'
  | 'device_groups.manage'
  | 'macros.read'
  | 'macros.manage'
  | 'runs.read'
  | 'runs.manage'
  | 'runs.execute'
  | 'approvals.read'
  | 'approvals.resolve'
  | 'accounts.read'
  | 'accounts.manage'
  | 'analytics.read'
  | 'schedules.read'
  | 'schedules.manage'
  | 'audit_logs.read_own'
  | 'audit_logs.read_all'
  | 'users.read'
  | 'users.manage'
  | 'roles.manage'
  | 'admin_resources.delete'
  | 'execution_profiles.read'
  | 'execution_profiles.manage'
  | 'readiness_reports.read'
  | 'readiness_reports.create'
  | 'readiness_reports.review'
  | 'system_monitor.read'
  | 'worker.claim_runs'
  | 'worker.write_artifacts'
  | 'worker.write_audit_logs'
  | 'bridge.execute_device_action'
  | 'scheduler.trigger_runs';

export type AccessCheck = {
  allowed: boolean;
  role: ActorRole | null;
  permission: Permission;
  reason?: string;
};

export const ROLE_LABELS: Record<ActorRole, string> = {
  VISITOR: 'Visitor',
  VIEWER: 'Viewer',
  OPERATOR: 'Operator',
  ADMIN: 'Admin',
  SYSTEM_WORKER: 'System Worker',
  MOBILE_MCP_BRIDGE: 'Mobile MCP Bridge',
  SCHEDULER: 'Scheduler',
};

const READ_ONLY_AUTHENTICATED_PERMISSIONS = [
  'app.read',
  'dashboard.read',
  'devices.read',
  'device_groups.read',
  'macros.read',
  'runs.read',
  'approvals.read',
  'accounts.read',
  'analytics.read',
  'schedules.read',
  'execution_profiles.read',
  'readiness_reports.read',
] as const satisfies readonly Permission[];

const OPERATOR_PERMISSIONS = [
  ...READ_ONLY_AUTHENTICATED_PERMISSIONS,
  'devices.manage',
  'devices.locks.manage',
  'device_groups.manage',
  'macros.manage',
  'runs.manage',
  'runs.execute',
  'approvals.resolve',
  'accounts.manage',
  'schedules.manage',
  'readiness_reports.create',
  'audit_logs.read_own',
  'system_monitor.read',
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS: Record<ActorRole, readonly Permission[]> = {
  VISITOR: ['public.auth.access'],
  VIEWER: READ_ONLY_AUTHENTICATED_PERMISSIONS,
  OPERATOR: OPERATOR_PERMISSIONS,
  ADMIN: [
    ...OPERATOR_PERMISSIONS,
    'audit_logs.read_all',
    'users.read',
    'users.manage',
    'roles.manage',
    'admin_resources.delete',
    'execution_profiles.manage',
    'readiness_reports.review',
  ],
  SYSTEM_WORKER: [
    'runs.read',
    'runs.execute',
    'worker.claim_runs',
    'worker.write_artifacts',
    'worker.write_audit_logs',
  ],
  MOBILE_MCP_BRIDGE: ['bridge.execute_device_action'],
  SCHEDULER: ['schedules.read', 'scheduler.trigger_runs'],
};

export function isKnownActorRole(role?: string | null): role is ActorRole {
  return Boolean(role && role in ROLE_PERMISSIONS);
}

export function isUserRole(role?: string | null): role is UserRole {
  return Boolean(role && USER_ROLES.includes(role as UserRole));
}

export function getRolePermissions(role?: ActorRole | null) {
  return role ? ROLE_PERMISSIONS[role] ?? [] : [];
}

export function hasPermission(role: ActorRole | null | undefined, permission: Permission) {
  return getRolePermissions(role).includes(permission);
}

export function hasAnyPermission(role: ActorRole | null | undefined, permissions: readonly Permission[]) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: ActorRole | null | undefined, permissions: readonly Permission[]) {
  return permissions.every((permission) => hasPermission(role, permission));
}

export function checkPermission(role: ActorRole | null | undefined, permission: Permission): AccessCheck {
  if (!role) {
    return { allowed: false, role: null, permission, reason: 'missing-role' };
  }

  if (!isKnownActorRole(role)) {
    return { allowed: false, role: null, permission, reason: 'unknown-role' };
  }

  if (!hasPermission(role, permission)) {
    return { allowed: false, role, permission, reason: 'permission-denied' };
  }

  return { allowed: true, role, permission };
}

export function getRoleLabel(role?: UserRole | null) {
  return role ? ROLE_LABELS[role] ?? 'Unknown' : 'Unknown';
}

export function isViewerRole(role?: UserRole | null) {
  return role === 'VIEWER';
}

export function canManageRuns(role?: UserRole | null) {
  return hasPermission(role, 'runs.manage');
}

export function canManageApprovals(role?: UserRole | null) {
  return hasPermission(role, 'approvals.resolve');
}

export function canManageMacros(role?: UserRole | null) {
  return hasPermission(role, 'macros.manage');
}

export function canViewAuditLogs(role?: UserRole | null) {
  return hasAnyPermission(role, ['audit_logs.read_own', 'audit_logs.read_all']);
}

export function canViewAllAuditLogs(role?: UserRole | null) {
  return hasPermission(role, 'audit_logs.read_all');
}

export function canManageDeviceLocks(role?: UserRole | null) {
  return hasPermission(role, 'devices.locks.manage');
}

export function canManageDevices(role?: UserRole | null) {
  return hasPermission(role, 'devices.manage');
}

export function canManageAccounts(role?: UserRole | null) {
  return hasPermission(role, 'accounts.manage');
}

export function canManageSchedules(role?: UserRole | null) {
  return hasPermission(role, 'schedules.manage');
}

export function canManageUsers(role?: UserRole | null) {
  return hasPermission(role, 'users.manage');
}

export function canDeleteAdminResources(role?: UserRole | null) {
  return hasPermission(role, 'admin_resources.delete');
}

export function canCreateReadinessReports(role?: UserRole | null) {
  return hasPermission(role, 'readiness_reports.create');
}

export function canReviewReadinessReports(role?: UserRole | null) {
  return hasPermission(role, 'readiness_reports.review');
}
