import type { Database } from '../../lib/database.types';

export type WorkflowRun = Database['public']['Tables']['workflow_runs']['Row'];
export type RunStep = Database['public']['Tables']['run_steps']['Row'];
export type Device = Database['public']['Tables']['devices']['Row'];
export type Approval = Database['public']['Tables']['approvals']['Row'];

export interface DeviceStatus {
  device: Device;
  steps: RunStep[];
  successCount: number;
  failedCount: number;
  pendingCount: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_APPROVAL' | 'CANCELLED' | 'PARTIAL_SUCCESS';
}
