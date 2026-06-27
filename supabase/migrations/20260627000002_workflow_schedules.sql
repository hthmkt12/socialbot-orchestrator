CREATE TABLE IF NOT EXISTS workflow_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  macro_id uuid NOT NULL REFERENCES macros(id) ON DELETE CASCADE,
  macro_version_id uuid NOT NULL REFERENCES macro_versions(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  target_group_id uuid REFERENCES device_groups(id) ON DELETE SET NULL,
  input_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  is_active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
  ON workflow_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON workflow_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON workflow_schedules FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Enable delete for authenticated users"
  ON workflow_schedules FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run
  ON workflow_schedules(next_run_at)
  WHERE is_active = true;
