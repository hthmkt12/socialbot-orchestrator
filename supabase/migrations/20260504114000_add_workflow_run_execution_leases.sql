ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS execution_owner text,
  ADD COLUMN IF NOT EXISTS execution_claim_token text,
  ADD COLUMN IF NOT EXISTS execution_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wr_execution_lease
  ON workflow_runs(status, execution_lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_wr_execution_owner
  ON workflow_runs(execution_owner, execution_claim_token);
