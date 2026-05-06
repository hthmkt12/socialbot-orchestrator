import type { RunStatus } from '../../lib/database.types';

export type FilterStatus = 'ALL' | RunStatus;

export interface RunsStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
}
