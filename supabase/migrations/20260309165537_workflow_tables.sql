/*
  # Workflow: Macros, Macro Versions, Workflow Runs, Run Steps

  1. New Tables
    - `macros` - Reusable macro definitions
      - `id` (uuid, PK)
      - `key` (text, unique identifier slug)
      - `name` (text)
      - `description` (text)
      - `latest_version_id` (uuid, nullable FK to macro_versions)
      - `created_by_user_id` (uuid, FK to profiles)
    - `macro_versions` - Versioned macro definitions
      - `id` (uuid, PK)
      - `macro_id` (uuid, FK to macros)
      - `version_number` (integer)
      - `status` (text: DRAFT, ACTIVE, ARCHIVED)
      - `definition_json` (jsonb) - The canonical macro JSON
      - `input_schema_json` (jsonb)
      - `tags_json` (jsonb)
    - `workflow_runs` - Execution runs of macros
      - `id` (uuid, PK)
      - `macro_version_id` (uuid, FK)
      - `triggered_by_user_id` (uuid, FK)
      - `target_type` (text: SINGLE_DEVICE, DEVICE_GROUP, MULTI_DEVICE, ALL_DEVICES)
      - `target_selector_json` (jsonb)
      - `status` (text: PENDING, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED, PARTIAL_SUCCESS, WAITING_APPROVAL)
      - `started_at`, `finished_at`, `cancelled_at` (timestamptz)
      - `summary_json` (jsonb)
    - `run_steps` - Individual step execution records
      - `id` (uuid, PK)
      - `workflow_run_id` (uuid, FK)
      - `device_id` (uuid, FK)
      - `step_index` (integer)
      - `step_id` (text)
      - `step_type` (text)
      - `status` (text)
      - `input_json`, `output_json`, `error_json` (jsonb)
      - `retry_count` (integer)
      - `screenshot_artifact_id` (uuid, nullable)

  2. Security
    - RLS on all tables
    - Macros: authenticated read, operators+ write
    - Runs: users read own, admins read all
    - Steps: accessible through run ownership
*/

-- Macros table
CREATE TABLE IF NOT EXISTS macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  latest_version_id uuid,
  created_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macros_key ON macros(key);
CREATE INDEX IF NOT EXISTS idx_macros_created_by ON macros(created_by_user_id);

ALTER TABLE macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read macros"
  ON macros FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert macros"
  ON macros FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update macros"
  ON macros FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Admins can delete macros"
  ON macros FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

-- Macro versions
CREATE TABLE IF NOT EXISTS macro_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_id uuid NOT NULL REFERENCES macros(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  definition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_schema_json jsonb DEFAULT '{}'::jsonb,
  tags_json jsonb DEFAULT '[]'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(macro_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_mv_macro ON macro_versions(macro_id);
CREATE INDEX IF NOT EXISTS idx_mv_status ON macro_versions(status);

ALTER TABLE macro_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read macro versions"
  ON macro_versions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert macro versions"
  ON macro_versions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update macro versions"
  ON macro_versions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

-- Add FK from macros.latest_version_id to macro_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_macros_latest_version'
  ) THEN
    ALTER TABLE macros
      ADD CONSTRAINT fk_macros_latest_version
      FOREIGN KEY (latest_version_id) REFERENCES macro_versions(id);
  END IF;
END $$;

-- Workflow runs
CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_version_id uuid NOT NULL REFERENCES macro_versions(id) ON DELETE CASCADE,
  triggered_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT 'SINGLE_DEVICE'
    CHECK (target_type IN ('SINGLE_DEVICE', 'DEVICE_GROUP', 'MULTI_DEVICE', 'ALL_DEVICES')),
  target_selector_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS', 'WAITING_APPROVAL')),
  input_variables_json jsonb DEFAULT '{}'::jsonb,
  execution_profile_id uuid REFERENCES execution_profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  summary_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wr_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_wr_triggered_by ON workflow_runs(triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_wr_macro_version ON workflow_runs(macro_version_id);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own runs"
  ON workflow_runs FOR SELECT
  TO authenticated
  USING (triggered_by_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can read all runs"
  ON workflow_runs FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "Operators and admins can insert runs"
  ON workflow_runs FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update runs"
  ON workflow_runs FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

-- Run steps
CREATE TABLE IF NOT EXISTS run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  step_index integer NOT NULL DEFAULT 0,
  step_id text NOT NULL DEFAULT '',
  step_type text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED', 'RETRYING', 'CANCELLED', 'WAITING_APPROVAL')),
  input_json jsonb DEFAULT '{}'::jsonb,
  output_json jsonb DEFAULT '{}'::jsonb,
  error_json jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  screenshot_artifact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rs_run ON run_steps(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_rs_device ON run_steps(device_id);
CREATE INDEX IF NOT EXISTS idx_rs_status ON run_steps(status);

ALTER TABLE run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read steps of own runs"
  ON run_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflow_runs wr
      JOIN profiles p ON p.id = wr.triggered_by_user_id
      WHERE wr.id = run_steps.workflow_run_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all steps"
  ON run_steps FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "Operators and admins can insert steps"
  ON run_steps FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update steps"
  ON run_steps FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));