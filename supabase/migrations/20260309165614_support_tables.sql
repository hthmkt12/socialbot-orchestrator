/*
  # Support: Artifacts, Approvals, Audit Logs, Device Locks

  1. New Tables
    - `artifacts` - Screenshots, logs, and other run output files
      - `id` (uuid, PK)
      - `workflow_run_id` (uuid, FK)
      - `device_id` (uuid, nullable FK)
      - `type` (text: SCREENSHOT, LOG_BLOB, SCRIPT_FILE, JSON_RESULT)
      - `storage_key` (text) - Path or S3 key
      - `content_type` (text)
      - `size` (bigint)
      - `metadata_json` (jsonb)
    - `approvals` - Approval requests for sensitive operations
      - `id` (uuid, PK)
      - `workflow_run_id` (uuid, FK)
      - `run_step_id` (uuid, nullable FK)
      - `status` (text: PENDING, APPROVED, REJECTED, EXPIRED)
      - `requested_by_user_id` (uuid, FK)
      - `reviewed_by_user_id` (uuid, nullable FK)
      - `reason` (text)
      - `payload_json` (jsonb)
    - `audit_logs` - Immutable audit trail
      - `id` (uuid, PK)
      - `actor_user_id` (uuid, nullable FK)
      - `action` (text)
      - `resource_type` (text)
      - `resource_id` (text)
      - `metadata_json` (jsonb)
    - `device_locks` - Exclusive execution locks per device
      - `id` (uuid, PK)
      - `device_id` (uuid, FK, unique)
      - `workflow_run_id` (uuid, FK)
      - `acquired_at` (timestamptz)
      - `expires_at` (timestamptz)

  2. Security
    - RLS on all tables
    - Artifacts: accessible through run ownership
    - Approvals: authenticated can read, operators+ can create/update
    - Audit logs: admins only
    - Device locks: operators+ can manage
*/

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('SCREENSHOT', 'LOG_BLOB', 'SCRIPT_FILE', 'JSON_RESULT')),
  storage_key text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  size bigint NOT NULL DEFAULT 0,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_device ON artifacts(device_id);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read artifacts of own runs"
  ON artifacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_runs wr
      JOIN profiles p ON p.id = wr.triggered_by_user_id
      WHERE wr.id = artifacts.workflow_run_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all artifacts"
  ON artifacts FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "Operators and admins can insert artifacts"
  ON artifacts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

-- Add FK from run_steps.screenshot_artifact_id to artifacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rs_screenshot_artifact'
  ) THEN
    ALTER TABLE run_steps
      ADD CONSTRAINT fk_rs_screenshot_artifact
      FOREIGN KEY (screenshot_artifact_id) REFERENCES artifacts(id);
  END IF;
END $$;

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  run_step_id uuid REFERENCES run_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  requested_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_by_user_id uuid REFERENCES profiles(id),
  reason text NOT NULL DEFAULT '',
  payload_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_approvals_run ON approvals(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approvals"
  ON approvals FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert approvals"
  ON approvals FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update approvals"
  ON approvals FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

-- Audit logs (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL DEFAULT '',
  resource_id text NOT NULL DEFAULT '',
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "Operators can read own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (actor_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

-- Device locks
CREATE TABLE IF NOT EXISTS device_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_dl_device ON device_locks(device_id);
CREATE INDEX IF NOT EXISTS idx_dl_expires ON device_locks(expires_at);

ALTER TABLE device_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read device locks"
  ON device_locks FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert device locks"
  ON device_locks FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can delete device locks"
  ON device_locks FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));