import type { UserRole } from './database.types';

export function getRoleLabel(role?: UserRole | null) {
  if (!role) return 'Unknown';
  if (role === 'ADMIN') return 'Admin';
  if (role === 'OPERATOR') return 'Operator';
  return 'Viewer';
}

export function isViewerRole(role?: UserRole | null) {
  return role === 'VIEWER';
}

export function canManageRuns(role?: UserRole | null) {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function canManageApprovals(role?: UserRole | null) {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function canManageMacros(role?: UserRole | null) {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function canViewAuditLogs(role?: UserRole | null) {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function canViewAllAuditLogs(role?: UserRole | null) {
  return role === 'ADMIN';
}
