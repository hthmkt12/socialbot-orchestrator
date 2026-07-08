import type { MacroDefinition } from '../contracts/macro';
import type { Account, TargetType, UserRole } from './database.types';
import type { ReadinessGateResult } from './readiness-gates';

export interface RunPreflightIssue {
  id: string;
  severity: 'blocking' | 'warning';
  title: string;
  detail: string;
  recoveryHint?: string;
}

export interface RunPreflightSummary {
  declaredTargetType: TargetType;
  blockingIssues: RunPreflightIssue[];
  warnings: RunPreflightIssue[];
  gates: ReadinessGateResult[];
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
  maxPilotTargetCount?: number;
  totalDevicesCount: number;
  groupMemberCount: number;
  runnableDeviceCount: number;
  dispatchableDeviceCount: number;
  staleDeviceCount: number;
  lockedTargetDevicesCount: number;
  expiredLockedTargetDevicesCount: number;
  inputValues: Record<string, string>;
  deviceLocksError?: string | null;
  selectedAccount?: Pick<Account, 'id' | 'username' | 'platform' | 'is_blocked' | 'daily_action_limit' | 'current_action_count' | 'warm_up_stage'> | null;
  requiresAccount?: boolean;
}
