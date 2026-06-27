export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR';
export type DeviceHeartbeatFreshness = 'fresh' | 'stale' | 'offline';
export type MacroVersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type RunStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIAL_SUCCESS' | 'WAITING_APPROVAL';
export type RunStepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'RETRYING' | 'CANCELLED' | 'WAITING_APPROVAL';
export type TargetType = 'SINGLE_DEVICE' | 'DEVICE_GROUP' | 'MULTI_DEVICE' | 'ALL_DEVICES';
export type ArtifactType = 'SCREENSHOT' | 'LOG_BLOB' | 'SCRIPT_FILE' | 'JSON_RESULT';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  laixi_device_id: string;
  name: string;
  model: string;
  brand: string;
  android_version: string;
  screen_width: number;
  screen_height: number;
  status: DeviceStatus;
  last_seen_at: string | null;
  heartbeat_freshness: DeviceHeartbeatFreshness;
  last_error_message: string | null;
  last_error_at: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceGroupMember {
  id: string;
  device_group_id: string;
  device_id: string;
}

export interface Macro {
  id: string;
  key: string;
  name: string;
  description: string;
  latest_version_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface MacroVersion {
  id: string;
  macro_id: string;
  version_number: number;
  status: MacroVersionStatus;
  definition_json: Record<string, unknown>;
  input_schema_json: Record<string, unknown>;
  tags_json: string[];
  created_by_user_id: string;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  macro_version_id: string;
  triggered_by_user_id: string;
  target_type: TargetType;
  target_selector_json: Record<string, unknown>;
  status: RunStatus;
  input_variables_json: Record<string, unknown>;
  execution_profile_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  execution_owner: string | null;
  execution_claim_token: string | null;
  execution_lease_expires_at: string | null;
  execution_heartbeat_at: string | null;
  summary_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RunStep {
  id: string;
  workflow_run_id: string;
  device_id: string;
  step_index: number;
  step_id: string;
  step_type: string;
  status: RunStepStatus;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_json: Record<string, unknown> | null;
  started_at: string | null;
  finished_at: string | null;
  retry_count: number;
  screenshot_artifact_id: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  workflow_run_id: string;
  device_id: string | null;
  type: ArtifactType;
  storage_key: string;
  content_type: string;
  size: number;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface Approval {
  id: string;
  workflow_run_id: string;
  run_step_id: string | null;
  status: ApprovalStatus;
  requested_by_user_id: string;
  reviewed_by_user_id: string | null;
  reason: string;
  payload_json: Record<string, unknown>;
  created_at: string;
  reviewed_at: string | null;
  step_id: string | null;
  step_type: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewer_notes: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface ExecutionProfile {
  id: string;
  name: string;
  description: string;
  concurrency_per_device: number;
  default_timeout_ms: number;
  max_retries: number;
  require_approval_for_adb: boolean;
  require_approval_for_autox: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountPlatform = 'instagram' | 'tiktok' | 'facebook';
export type AccountActionType = 'like' | 'follow' | 'comment' | 'post' | 'share';

export interface Account {
  id: string;
  user_id: string;
  username: string;
  encrypted_password: string;
  platform: AccountPlatform;
  warm_up_started_at: string | null;
  warm_up_stage: number;
  daily_action_limit: number;
  current_action_count: number;
  last_action_reset_at: string | null;
  is_blocked: boolean;
  detected_block_reason: string | null;
  created_at: string;
  updated_at: string;
}


export type AccountAnalytics = {
  id: string;
  account_id: string;
  snapshot_date: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number | null;
  created_at: string;
};

export interface AccountActionHistory {
  id: string;
  account_id: string;
  action_type: AccountActionType;
  step_id: string | null;
  success: boolean | null;
  error_message: string | null;
  created_at: string;
}

export interface DeviceLock {
  id: string;
  device_id: string;
  workflow_run_id: string;
  acquired_at: string;
  expires_at: string;
}

export interface WorkflowSchedule {
  id: string;
  name: string;
  macro_id: string;
  macro_version_id: string;
  target_type: TargetType;
  target_device_id: string | null;
  target_group_id: string | null;
  input_variables: Record<string, unknown>;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { user_id: string; email: string }; Update: Partial<Profile> };
      devices: { Row: Device; Insert: Partial<Device> & { laixi_device_id: string }; Update: Partial<Device> };
      device_groups: { Row: DeviceGroup; Insert: Partial<DeviceGroup> & { name: string }; Update: Partial<DeviceGroup> };
      device_group_members: { Row: DeviceGroupMember; Insert: Partial<DeviceGroupMember> & { device_group_id: string; device_id: string }; Update: Partial<DeviceGroupMember> };
      macros: { Row: Macro; Insert: Partial<Macro> & { key: string; name: string; created_by_user_id: string }; Update: Partial<Macro> };
      macro_versions: { Row: MacroVersion; Insert: Partial<MacroVersion> & { macro_id: string; created_by_user_id: string }; Update: Partial<MacroVersion> };
      workflow_runs: { Row: WorkflowRun; Insert: Partial<WorkflowRun> & { macro_version_id: string; triggered_by_user_id: string }; Update: Partial<WorkflowRun> };
      run_steps: { Row: RunStep; Insert: Partial<RunStep> & { workflow_run_id: string; device_id: string }; Update: Partial<RunStep> };
      artifacts: { Row: Artifact; Insert: Partial<Artifact> & { workflow_run_id: string; type: ArtifactType }; Update: Partial<Artifact> };
      approvals: { Row: Approval; Insert: Partial<Approval> & { workflow_run_id: string; requested_by_user_id: string }; Update: Partial<Approval> };
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog> & { action: string }; Update: Partial<AuditLog> };
      execution_profiles: { Row: ExecutionProfile; Insert: Partial<ExecutionProfile> & { name: string }; Update: Partial<ExecutionProfile> };
      device_locks: { Row: DeviceLock; Insert: Partial<DeviceLock> & { device_id: string; workflow_run_id: string }; Update: Partial<DeviceLock> };
      accounts: { Row: Account; Insert: Partial<Account> & { user_id: string; username: string; encrypted_password: string; platform: AccountPlatform }; Update: Partial<Account> };
      account_analytics: { Row: AccountAnalytics; Insert: Partial<AccountAnalytics> & { account_id: string }; Update: Partial<AccountAnalytics> };
      account_action_history: { Row: AccountActionHistory; Insert: Partial<AccountActionHistory> & { account_id: string; action_type: AccountActionType }; Update: Partial<AccountActionHistory> };
      workflow_schedules: { Row: WorkflowSchedule; Insert: Partial<WorkflowSchedule> & { name: string; macro_id: string; macro_version_id: string; target_type: TargetType; cron_expression: string }; Update: Partial<WorkflowSchedule> };
    };
  };
}
