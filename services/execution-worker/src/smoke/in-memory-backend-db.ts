import type { Device, WorkflowRun } from '../../../../src/lib/database.types';
import type { WorkflowRunControlStore, ControlRunRecord } from '../../../../packages/shared/src';

type Row = Record<string, unknown>;
type TableName =
  | 'workflow_runs'
  | 'devices'
  | 'macro_versions'
  | 'run_steps'
  | 'approvals'
  | 'device_locks'
  | 'artifacts';

type Tables = Record<TableName, Row[]>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function pickColumns(row: Row, columns: string[] | null) {
  if (!columns) return clone(row);
  return columns.reduce<Row>((picked, column) => {
    picked[column] = row[column];
    return picked;
  }, {});
}

function compareValues(left: unknown, right: unknown) {
  const leftValue = left instanceof Date ? left.toISOString() : String(left);
  const rightValue = right instanceof Date ? right.toISOString() : String(right);
  if (leftValue === rightValue) return 0;
  return leftValue < rightValue ? -1 : 1;
}

class InMemoryQuery {
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns: string[] | null | undefined;
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row = {};
  private payload: Row[] = [];
  private sort?: { field: string; ascending: boolean };
  private take?: number;

  constructor(private readonly db: InMemoryBackendDb, private readonly table: TableName) {}

  select(columns = '*') { this.columns = columns === '*' ? null : columns.split(',').map((part) => part.trim()); return this; }
  insert(payload: Row | Row[]) { this.mode = 'insert'; this.payload = Array.isArray(payload) ? payload : [payload]; return this; }
  update(patch: Row) { this.mode = 'update'; this.patch = patch; return this; }
  delete() { this.mode = 'delete'; return this; }
  eq(field: string, value: unknown) { this.filters.push((row) => row[field] === value); return this; }
  in(field: string, values: unknown[]) { this.filters.push((row) => values.includes(row[field])); return this; }
  lt(field: string, value: unknown) { this.filters.push((row) => row[field] !== null && row[field] !== undefined && compareValues(row[field], value) < 0); return this; }
  is(field: string, value: unknown) { this.filters.push((row) => row[field] === value); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.sort = { field, ascending: options?.ascending !== false }; return this; }
  limit(count: number) { this.take = count; return this; }

  async maybeSingle() {
    const result = await this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return { data: rows[0] ?? null, error: result.error };
  }

  then<TResult1 = { data: unknown; error: { message: string; code?: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string; code?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      let rows = this.db.rows(this.table);
      if (this.mode === 'insert') rows = this.payload.map((row) => this.db.insertRow(this.table, row));
      if (this.mode === 'update') rows = this.db.updateRows(this.table, this.filters, this.patch);
      if (this.mode === 'delete') rows = this.db.deleteRows(this.table, this.filters);
      if (this.mode === 'select') rows = rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.sort) {
        const { field, ascending } = this.sort;
        rows = [...rows].sort((left, right) => compareValues(left[field], right[field]) * (ascending ? 1 : -1));
      }
      if (typeof this.take === 'number') rows = rows.slice(0, this.take);
      const data = this.columns === undefined && this.mode !== 'select' ? null : rows.map((row) => pickColumns(row, this.columns ?? null));
      return { data, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : undefined;
      return { data: null, error: { message, ...(code ? { code } : {}) } };
    }
  }
}

export class InMemoryBackendDb implements WorkflowRunControlStore {
  private readonly tables: Tables = {
    workflow_runs: [],
    devices: [],
    macro_versions: [],
    run_steps: [],
    approvals: [],
    device_locks: [],
    artifacts: [],
  };
  private counter = 0;

  from(table: TableName) { return new InMemoryQuery(this, table); }
  asSupabase() {
    return {
      from: (table: TableName) => this.from(table),
      storage: {
        from: () => ({
          upload: async () => ({ error: null })
        })
      }
    } as never;
  }
  rows(table: TableName) { return this.tables[table]; }
  seed(table: TableName, row: Row) { this.tables[table].push(this.normalizeRow(table, row)); }
  getWorkflowRun(runId: string) { return this.tables.workflow_runs.find((row) => row.id === runId) as WorkflowRun | undefined; }
  getDevice(deviceId: string) { return this.tables.devices.find((row) => row.id === deviceId) as Device | undefined; }

  async getRun(runId: string): Promise<ControlRunRecord | null> {
    const run = this.getWorkflowRun(runId);
    return run ? { id: run.id, status: run.status, summaryJson: (run.summary_json as Record<string, unknown> | null) ?? null } : null;
  }

  async queuePendingRun(runId: string, summaryJson: Record<string, unknown>) {
    const run = this.getWorkflowRun(runId);
    if (!run || run.status !== 'PENDING') return null;
    run.status = 'QUEUED';
    run.summary_json = clone(summaryJson);
    return this.getRun(runId);
  }

  async updateRunSummary(runId: string, summaryJson: Record<string, unknown>) {
    const run = this.getWorkflowRun(runId);
    if (run) run.summary_json = clone(summaryJson);
  }

  async cancelActiveRun(runId: string, now: string, summaryJson: Record<string, unknown>) {
    const run = this.getWorkflowRun(runId);
    if (!run || !['PENDING', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL'].includes(run.status)) return null;
    Object.assign(run, {
      status: 'CANCELLED',
      cancelled_at: now,
      finished_at: now,
      execution_owner: null,
      execution_claim_token: null,
      execution_lease_expires_at: null,
      execution_heartbeat_at: null,
      summary_json: clone(summaryJson),
    });
    return this.getRun(runId);
  }

  async cleanupCancelledRun(runId: string, now: string) {
    for (const row of this.tables.run_steps) {
      if (row.workflow_run_id === runId && ['PENDING', 'RUNNING', 'RETRYING', 'WAITING_APPROVAL'].includes(String(row.status))) {
        row.status = 'CANCELLED';
        row.finished_at = now;
      }
    }
    this.tables.device_locks = this.tables.device_locks.filter((row) => row.workflow_run_id !== runId);
    for (const row of this.tables.approvals) {
      if (row.workflow_run_id === runId && row.status === 'PENDING') row.status = 'EXPIRED';
    }
  }

  approveAndRequeue(runId: string, stepId: string, reviewerId = 'reviewer-1') {
    const approval = this.tables.approvals.find((row) => row.workflow_run_id === runId && row.step_id === stepId && row.status === 'PENDING');
    if (!approval) throw new Error(`Pending approval not found for ${runId}/${stepId}`);
    const reviewedAt = new Date().toISOString();
    Object.assign(approval, { status: 'APPROVED', reviewed_by_user_id: reviewerId, reviewed_at: reviewedAt });
    const run = this.getWorkflowRun(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    Object.assign(run, {
      status: 'QUEUED',
      execution_owner: null,
      execution_claim_token: null,
      execution_lease_expires_at: null,
      execution_heartbeat_at: null,
    });
  }

  insertRow(table: TableName, row: Row) {
    if (table === 'device_locks' && this.tables.device_locks.some((item) => item.device_id === row.device_id)) {
      const error = new Error('duplicate key value violates unique constraint');
      (error as Error & { code: string }).code = '23505';
      throw error;
    }
    const normalized = this.normalizeRow(table, row);
    this.tables[table].push(normalized);
    return normalized;
  }

  updateRows(table: TableName, filters: Array<(row: Row) => boolean>, patch: Row) {
    return this.tables[table]
      .filter((row) => filters.every((filter) => filter(row)))
      .map((row) => Object.assign(row, clone(patch)));
  }

  deleteRows(table: TableName, filters: Array<(row: Row) => boolean>) {
    const matches = this.tables[table].filter((row) => filters.every((filter) => filter(row)));
    this.tables[table] = this.tables[table].filter((row) => !filters.every((filter) => filter(row)));
    return matches;
  }

  private normalizeRow(table: TableName, row: Row) {
    const now = new Date().toISOString();
    return {
      id: String(row.id ?? `${table}-${++this.counter}`),
      created_at: row.created_at ?? now,
      ...clone(row),
    };
  }
}
