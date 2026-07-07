import type { MacroDefinition } from '../contracts/macro';
import type { Account, TargetType, UserRole } from './database.types';

export interface RunPreflightIssue {
  id: string;
  severity: 'blocking' | 'warning';
  title: string;
  detail: string;
}

export interface RunPreflightSummary {
  declaredTargetType: TargetType;
  blockingIssues: RunPreflightIssue[];
  warnings: RunPreflightIssue[];
  sensitiveStepCount: number;
  approvalStepCount: number;
}

export interface BuildRunPreflightSummaryArgs {
  definition: MacroDefinition | undefined;
  targetType: TargetType;
  profileRole?: UserRole | null;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  targetDevicesCount: number;
  totalDevicesCount: number;
  groupMemberCount: number;
  runnableDeviceCount: number;
  dispatchableDeviceCount: number;
  staleDeviceCount: number;
  lockedTargetDevicesCount: number;
  expiredLockedTargetDevicesCount: number;
  inputValues: Record<string, string>;
  deviceLocksError?: string | null;
  selectedAccount?: Pick<Account, 'id' | 'username' | 'is_blocked' | 'daily_action_limit' | 'current_action_count' | 'warm_up_stage'> | null;
  requiresAccount?: boolean;
}
