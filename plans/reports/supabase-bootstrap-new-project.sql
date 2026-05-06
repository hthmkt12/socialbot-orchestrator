-- Supabase bootstrap SQL for new project
-- Generated from supabase/migrations in timestamp order.
-- Run this in Supabase Dashboard > SQL Editor for project gzwwqhgvrfsqokrxfhyu.


-- ==========================================================================
-- Migration: 20260309165454_foundation_tables.sql
-- ==========================================================================

/*
  # Foundation: Profiles, Devices, Device Groups, Execution Profiles

  1. New Tables
    - `profiles` - User profiles extending auth.users with role
    - `devices` - Android devices connected through Laixi
    - `device_groups` - Groups for organizing devices
    - `device_group_members` - Many-to-many between groups and devices
    - `execution_profiles` - Configuration profiles for workflow execution

  2. Security
    - RLS enabled on all tables
    - Role-based access using get_user_role() helper
    - Auto-profile creation on auth signup

  3. Functions
    - `get_user_role()` - Returns current user's role
    - `handle_new_user()` - Auto-creates profile on signup
*/

-- Profiles table (must be created before get_user_role function)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() = 'ADMIN');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'OPERATOR');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  laixi_device_id text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  android_version text NOT NULL DEFAULT '',
  screen_width integer NOT NULL DEFAULT 0,
  screen_height integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'BUSY', 'ERROR')),
  last_seen_at timestamptz,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read devices"
  ON devices FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert devices"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update devices"
  ON devices FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Admins can delete devices"
  ON devices FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

-- Device groups
CREATE TABLE IF NOT EXISTS device_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE device_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read device groups"
  ON device_groups FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert device groups"
  ON device_groups FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can update device groups"
  ON device_groups FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Admins can delete device groups"
  ON device_groups FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

-- Device group members
CREATE TABLE IF NOT EXISTS device_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_group_id uuid NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE(device_group_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_dgm_group ON device_group_members(device_group_id);
CREATE INDEX IF NOT EXISTS idx_dgm_device ON device_group_members(device_id);

ALTER TABLE device_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read group members"
  ON device_group_members FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Operators and admins can insert group members"
  ON device_group_members FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

CREATE POLICY "Operators and admins can delete group members"
  ON device_group_members FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')));

-- Execution profiles
CREATE TABLE IF NOT EXISTS execution_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  concurrency_per_device integer NOT NULL DEFAULT 1,
  default_timeout_ms integer NOT NULL DEFAULT 10000,
  max_retries integer NOT NULL DEFAULT 2,
  require_approval_for_adb boolean NOT NULL DEFAULT true,
  require_approval_for_autox boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE execution_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read execution profiles"
  ON execution_profiles FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert execution profiles"
  ON execution_profiles FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Admins can update execution profiles"
  ON execution_profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Admins can delete execution profiles"
  ON execution_profiles FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

-- ==========================================================================
-- Migration: 20260309165537_workflow_tables.sql
-- ==========================================================================

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

-- ==========================================================================
-- Migration: 20260309165614_support_tables.sql
-- ==========================================================================

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

-- ==========================================================================
-- Migration: 20260309170933_seed_execution_profile.sql
-- ==========================================================================

/*
  # Seed Data: Default Execution Profile

  1. Data
    - Default execution profile for workflow runs
      - 1 concurrent run per device
      - 10s timeout
      - 2 max retries
      - Requires approval for ADB and AutoX commands

  2. Notes
    - This provides a sensible default configuration
    - Admins can create additional profiles from the UI
*/

INSERT INTO execution_profiles (name, description, concurrency_per_device, default_timeout_ms, max_retries, require_approval_for_adb, require_approval_for_autox)
VALUES (
  'Default',
  'Default execution profile with standard safety settings',
  1,
  10000,
  2,
  true,
  true
)
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- Migration: 20260310013146_seed_demo_data.sql
-- ==========================================================================

/*
  # Seed Demo Data

  1. Data Inserted
    - 4 Android devices (simulated Laixi-connected phones)
      - Pixel 7 Pro (ONLINE)
      - Samsung Galaxy S23 (ONLINE)
      - OnePlus 11 (OFFLINE)
      - Xiaomi 13 (BUSY)
    - 2 Device Groups
      - "Production Fleet" containing Pixel 7 Pro and Galaxy S23
      - "Testing Phones" containing OnePlus 11 and Xiaomi 13
    - 1 Execution Profile
      - "Fast - No Approval" for demo runs without approval gates

  2. Notes
    - Macros, macro versions, and workflow runs require a real user profile
      (created_by_user_id FK to profiles). Those are seeded via the UI
      "Seed Sample Macros" button after first login.
    - Devices are inserted with realistic metadata (battery, charging status)
    - The seed is idempotent using ON CONFLICT DO NOTHING
*/

-- Seed devices
INSERT INTO devices (laixi_device_id, name, model, brand, android_version, screen_width, screen_height, status, last_seen_at, metadata_json)
VALUES
  ('laixi_pixel7pro_001', 'Pixel 7 Pro #1', 'Pixel 7 Pro', 'Google', '14.0', 1440, 3120, 'ONLINE', now(), '{"batteryLevel": 87, "isCharging": false, "wifiSSID": "LabNetwork-5G", "imei": "353456789012345"}'),
  ('laixi_galaxy_s23_002', 'Galaxy S23 #2', 'Galaxy S23', 'Samsung', '14.0', 1080, 2340, 'ONLINE', now(), '{"batteryLevel": 62, "isCharging": true, "wifiSSID": "LabNetwork-5G", "imei": "353456789012346"}'),
  ('laixi_oneplus11_003', 'OnePlus 11 #3', 'OnePlus 11', 'OnePlus', '13.0', 1440, 3216, 'OFFLINE', now() - interval '2 hours', '{"batteryLevel": 15, "isCharging": false, "wifiSSID": null, "imei": "353456789012347"}'),
  ('laixi_xiaomi13_004', 'Xiaomi 13 #4', 'Xiaomi 13', 'Xiaomi', '13.0', 1080, 2400, 'BUSY', now(), '{"batteryLevel": 44, "isCharging": false, "wifiSSID": "LabNetwork-5G", "imei": "353456789012348"}')
ON CONFLICT (laixi_device_id) DO NOTHING;

-- Seed device groups
INSERT INTO device_groups (name, description)
VALUES
  ('Production Fleet', 'Primary devices used for production workflow runs'),
  ('Testing Phones', 'Devices reserved for testing and QA workflows')
ON CONFLICT (name) DO NOTHING;

-- Seed device group members (link devices to groups)
DO $$
DECLARE
  v_pixel_id uuid;
  v_galaxy_id uuid;
  v_oneplus_id uuid;
  v_xiaomi_id uuid;
  v_prod_group_id uuid;
  v_test_group_id uuid;
BEGIN
  SELECT id INTO v_pixel_id FROM devices WHERE laixi_device_id = 'laixi_pixel7pro_001';
  SELECT id INTO v_galaxy_id FROM devices WHERE laixi_device_id = 'laixi_galaxy_s23_002';
  SELECT id INTO v_oneplus_id FROM devices WHERE laixi_device_id = 'laixi_oneplus11_003';
  SELECT id INTO v_xiaomi_id FROM devices WHERE laixi_device_id = 'laixi_xiaomi13_004';
  SELECT id INTO v_prod_group_id FROM device_groups WHERE name = 'Production Fleet';
  SELECT id INTO v_test_group_id FROM device_groups WHERE name = 'Testing Phones';

  IF v_pixel_id IS NOT NULL AND v_prod_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_prod_group_id, v_pixel_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;

  IF v_galaxy_id IS NOT NULL AND v_prod_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_prod_group_id, v_galaxy_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;

  IF v_oneplus_id IS NOT NULL AND v_test_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_test_group_id, v_oneplus_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;

  IF v_xiaomi_id IS NOT NULL AND v_test_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_test_group_id, v_xiaomi_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;
END $$;

-- Seed a fast execution profile (no approval gates, for demo)
INSERT INTO execution_profiles (name, description, concurrency_per_device, default_timeout_ms, max_retries, require_approval_for_adb, require_approval_for_autox)
VALUES (
  'Fast - No Approval',
  'Fast execution profile for demos. No approval required for ADB or AutoX commands.',
  1,
  15000,
  1,
  false,
  false
)
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- Migration: 20260310013220_seed_macros_function.sql
-- ==========================================================================

/*
  # Seed Macros Function

  1. New Function
    - `seed_demo_macros(p_profile_id uuid)` - Creates demo macros for a user
      - Creates 3 macros: launch_app_and_capture, input_text_demo, current_app_check
      - Creates version 1 for each macro with ACTIVE status
      - Sets latest_version_id on each macro
      - Idempotent: skips macros that already exist (by key)

  2. Notes
    - Called from the frontend "Seed Sample Macros" button
    - The function runs as SECURITY DEFINER to bypass RLS for seeding
    - Only creates data if the macros don't already exist
*/

CREATE OR REPLACE FUNCTION seed_demo_macros(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_macro_id uuid;
  v_version_id uuid;
  v_count integer := 0;
BEGIN
  -- 1. launch_app_and_capture
  IF NOT EXISTS (SELECT 1 FROM public.macros WHERE key = 'launch_app_and_capture') THEN
    INSERT INTO public.macros (key, name, description, created_by_user_id)
    VALUES ('launch_app_and_capture', 'Launch App And Capture', 'Launch an app, wait, then capture a screenshot', p_profile_id)
    RETURNING id INTO v_macro_id;

    INSERT INTO public.macro_versions (macro_id, version_number, status, definition_json, input_schema_json, tags_json, created_by_user_id)
    VALUES (
      v_macro_id,
      1,
      'ACTIVE',
      '{
        "version": 1,
        "meta": {"key": "launch_app_and_capture", "name": "Launch App And Capture", "description": "Launch an app, wait, then capture a screenshot", "tags": ["demo", "capture"]},
        "inputs": {"appName": {"type": "string", "required": true, "description": "App package name to launch"}},
        "target": {"mode": "single_device"},
        "execution": {"defaultTimeoutMs": 10000, "maxRetries": 1, "onError": "stop"},
        "steps": [
          {"id": "launch", "type": "launch_app", "params": {"appName": "{{appName}}"}},
          {"id": "wait1", "type": "wait", "params": {"ms": 3000}},
          {"id": "screen1", "type": "screenshot", "params": {"saveToArtifact": true}},
          {"id": "current1", "type": "get_current_app", "params": {}}
        ]
      }'::jsonb,
      '{"appName": {"type": "string", "required": true, "description": "App package name to launch"}}'::jsonb,
      '["demo", "capture"]'::jsonb,
      p_profile_id
    )
    RETURNING id INTO v_version_id;

    UPDATE public.macros SET latest_version_id = v_version_id WHERE id = v_macro_id;
    v_count := v_count + 1;
  END IF;

  -- 2. input_text_demo
  IF NOT EXISTS (SELECT 1 FROM public.macros WHERE key = 'input_text_demo') THEN
    INSERT INTO public.macros (key, name, description, created_by_user_id)
    VALUES ('input_text_demo', 'Input Text Demo', 'Tap a field and type text', p_profile_id)
    RETURNING id INTO v_macro_id;

    INSERT INTO public.macro_versions (macro_id, version_number, status, definition_json, input_schema_json, tags_json, created_by_user_id)
    VALUES (
      v_macro_id,
      1,
      'ACTIVE',
      '{
        "version": 1,
        "meta": {"key": "input_text_demo", "name": "Input Text Demo", "description": "Tap a field and type text", "tags": ["demo"]},
        "inputs": {"text": {"type": "string", "required": true, "description": "Text to input"}},
        "target": {"mode": "single_device"},
        "execution": {"defaultTimeoutMs": 10000, "maxRetries": 0, "onError": "stop"},
        "steps": [
          {"id": "tap_field", "type": "tap", "params": {"x": 0.5, "y": 0.3}},
          {"id": "wait1", "type": "wait", "params": {"ms": 500}},
          {"id": "type_text", "type": "input_text", "params": {"text": "{{text}}"}},
          {"id": "screen1", "type": "screenshot", "params": {"saveToArtifact": true}}
        ]
      }'::jsonb,
      '{"text": {"type": "string", "required": true, "description": "Text to input"}}'::jsonb,
      '["demo"]'::jsonb,
      p_profile_id
    )
    RETURNING id INTO v_version_id;

    UPDATE public.macros SET latest_version_id = v_version_id WHERE id = v_macro_id;
    v_count := v_count + 1;
  END IF;

  -- 3. current_app_check
  IF NOT EXISTS (SELECT 1 FROM public.macros WHERE key = 'current_app_check') THEN
    INSERT INTO public.macros (key, name, description, created_by_user_id)
    VALUES ('current_app_check', 'Current App Check', 'Check current app and take conditional screenshot', p_profile_id)
    RETURNING id INTO v_macro_id;

    INSERT INTO public.macro_versions (macro_id, version_number, status, definition_json, input_schema_json, tags_json, created_by_user_id)
    VALUES (
      v_macro_id,
      1,
      'ACTIVE',
      '{
        "version": 1,
        "meta": {"key": "current_app_check", "name": "Current App Check", "description": "Check current app and take conditional screenshot", "tags": ["demo"]},
        "inputs": {"expectedPackage": {"type": "string", "required": true, "description": "Expected package name"}},
        "target": {"mode": "single_device"},
        "execution": {"defaultTimeoutMs": 15000, "maxRetries": 1, "onError": "stop"},
        "steps": [
          {"id": "get_app", "type": "get_current_app", "params": {}},
          {
            "id": "check_app", "type": "conditional",
            "params": {"left": "{{steps.get_app.output.appPackage}}", "operator": "equals", "right": "{{expectedPackage}}"},
            "then": [{"id": "capture_match", "type": "screenshot", "params": {"saveToArtifact": true}}],
            "else": [{"id": "stop_mismatch", "type": "stop", "params": {"reason": "Unexpected app running"}}]
          }
        ]
      }'::jsonb,
      '{"expectedPackage": {"type": "string", "required": true, "description": "Expected package name"}}'::jsonb,
      '["demo"]'::jsonb,
      p_profile_id
    )
    RETURNING id INTO v_version_id;

    UPDATE public.macros SET latest_version_id = v_version_id WHERE id = v_macro_id;
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$$;

-- ==========================================================================
-- Migration: 20260310015804_extend_seed_macros_to_10_samples.sql
-- ==========================================================================

/*
  # Extend Demo Macros Seeding Function

  ## Summary
  This migration replaces the `seed_demo_macros()` function to seed all 10 canonical sample macros
  instead of just 3. The function is idempotent and uses macro `key` as the stable unique identifier.

  ## Changes
  1. **Function Replacement**
     - Replaces existing `seed_demo_macros()` function
     - Extends from 3 macros to 10 comprehensive samples
     - Maintains idempotent behavior (safe to run multiple times)

  2. **10 Sample Macros Included**
     - `launch_app_and_capture` - Basic app launch, wait, screenshot, get current app
     - `input_text_demo` - App launch, tap input field, enter text, screenshot
     - `open_and_swipe_feed` - Launch app and swipe feed multiple times
     - `current_app_guard` - Conditional flow based on current app validation
     - `multi_device_launch_check` - Multi-device batch execution demo
     - `approval_before_adb` - Approval checkpoint before ADB command
     - `run_autox_with_approval` - AutoX.js script execution with approval
     - `settings_smoke_test` - System settings smoke test with validation
     - `simple_form_fill_demo` - Multi-field form filling demonstration
     - `grouped_demo_sequence` - Grouped step execution pattern

  3. **Upsert Logic**
     - Uses macro `key` for stable identification
     - Updates existing macros safely
     - Creates new macro versions consistently
     - Marks latest version as ACTIVE
     - Links macro.latest_version_id correctly

  4. **Return Value**
     - Returns JSON summary with inserted and updated counts
     - Provides audit trail of seeding operation

  ## Notes
  - All macro definitions use canonical JSON format
  - Existing macros are preserved and updated
  - Frontend "Load Samples" button continues to work
  - Safe to run multiple times without duplicates
*/

CREATE OR REPLACE FUNCTION seed_demo_macros()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid;
  inserted_count int := 0;
  updated_count int := 0;
  macro_record record;
  version_record record;
  macro_data jsonb;
  all_macros jsonb[];
BEGIN
  -- Get admin user (first user with ADMIN role)
  SELECT id INTO admin_user_id
  FROM users
  WHERE role = 'ADMIN'
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;

  -- Define all 10 sample macros
  all_macros := ARRAY[
    -- 1. Launch App And Capture
    jsonb_build_object(
      'key', 'launch_app_and_capture',
      'name', 'Launch App And Capture',
      'description', 'Má»Ÿ app, chá» vÃ i giÃ¢y, chá»¥p mÃ n hÃ¬nh, láº¥y app hiá»‡n táº¡i',
      'tags', jsonb_build_array('basic', 'screenshot', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'launch_app_and_capture',
          'name', 'Launch App And Capture',
          'description', 'Má»Ÿ app, chá» vÃ i giÃ¢y, chá»¥p mÃ n hÃ¬nh, láº¥y app hiá»‡n táº¡i',
          'tags', jsonb_build_array('basic', 'screenshot', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 10000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object())
        )
      )
    ),
    -- 2. Input Text Demo
    jsonb_build_object(
      'key', 'input_text_demo',
      'name', 'Input Text Demo',
      'description', 'Má»Ÿ app, cháº¡m vÃ¹ng nháº­p, nháº­p text, chá»¥p mÃ n hÃ¬nh',
      'tags', jsonb_build_array('input', 'demo', 'ui'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'input_text_demo',
          'name', 'Input Text Demo',
          'description', 'Má»Ÿ app, cháº¡m vÃ¹ng nháº­p, nháº­p text, chá»¥p mÃ n hÃ¬nh',
          'tags', jsonb_build_array('input', 'demo', 'ui')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true),
          'textValue', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 12000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
          jsonb_build_object('id', 'tap_1', 'type', 'tap', 'params', jsonb_build_object('x', 0.5, 'y', 0.3)),
          jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 800)),
          jsonb_build_object('id', 'input_1', 'type', 'input_text', 'params', jsonb_build_object('text', '{{textValue}}')),
          jsonb_build_object('id', 'wait_3', 'type', 'wait', 'params', jsonb_build_object('ms', 1000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 3. Open And Swipe Feed
    jsonb_build_object(
      'key', 'open_and_swipe_feed',
      'name', 'Open And Swipe Feed',
      'description', 'Má»Ÿ app vÃ  cuá»™n feed vÃ i láº§n Ä‘á»ƒ kiá»ƒm tra UI',
      'tags', jsonb_build_array('swipe', 'feed', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'open_and_swipe_feed',
          'name', 'Open And Swipe Feed',
          'description', 'Má»Ÿ app vÃ  cuá»™n feed vÃ i láº§n Ä‘á»ƒ kiá»ƒm tra UI',
          'tags', jsonb_build_array('swipe', 'feed', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 15000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'swipe_1', 'type', 'swipe', 'params', jsonb_build_object('fromX', 0.5, 'fromY', 0.8, 'toX', 0.5, 'toY', 0.25)),
          jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 1200)),
          jsonb_build_object('id', 'swipe_2', 'type', 'swipe', 'params', jsonb_build_object('fromX', 0.5, 'fromY', 0.8, 'toX', 0.5, 'toY', 0.25)),
          jsonb_build_object('id', 'wait_3', 'type', 'wait', 'params', jsonb_build_object('ms', 1200)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 4. Current App Guard
    jsonb_build_object(
      'key', 'current_app_guard',
      'name', 'Current App Guard',
      'description', 'Kiá»ƒm tra app hiá»‡n táº¡i, náº¿u Ä‘Ãºng thÃ¬ chá»¥p mÃ n hÃ¬nh, sai thÃ¬ dá»«ng',
      'tags', jsonb_build_array('guard', 'conditional', 'validation'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'current_app_guard',
          'name', 'Current App Guard',
          'description', 'Kiá»ƒm tra app hiá»‡n táº¡i, náº¿u Ä‘Ãºng thÃ¬ chá»¥p mÃ n hÃ¬nh, sai thÃ¬ dá»«ng',
          'tags', jsonb_build_array('guard', 'conditional', 'validation')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true),
          'expectedPackage', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 12000, 'maxRetries', 0, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object()),
          jsonb_build_object(
            'id', 'if_1',
            'type', 'conditional',
            'params', jsonb_build_object('left', '{{steps.current_1.output.appPackage}}', 'operator', 'equals', 'right', '{{expectedPackage}}'),
            'then', jsonb_build_array(
              jsonb_build_object('id', 'screen_ok', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
            ),
            'else', jsonb_build_array(
              jsonb_build_object('id', 'stop_fail', 'type', 'stop', 'params', jsonb_build_object('reason', 'Current package does not match expectedPackage'))
            )
          )
        )
      )
    ),
    -- 5. Multi Device Launch Check
    jsonb_build_object(
      'key', 'multi_device_launch_check',
      'name', 'Multi Device Launch Check',
      'description', 'Cháº¡y cÃ¹ng má»™t flow trÃªn nhiá»u thiáº¿t bá»‹',
      'tags', jsonb_build_array('multi-device', 'batch', 'monitoring'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'multi_device_launch_check',
          'name', 'Multi Device Launch Check',
          'description', 'Cháº¡y cÃ¹ng má»™t flow trÃªn nhiá»u thiáº¿t bá»‹',
          'tags', jsonb_build_array('multi-device', 'batch', 'monitoring')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'multi_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 15000, 'maxRetries', 1, 'onError', 'continue'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object())
        )
      )
    ),
    -- 6. Approval Before ADB
    jsonb_build_object(
      'key', 'approval_before_adb',
      'name', 'Approval Before ADB',
      'description', 'YÃªu cáº§u phÃª duyá»‡t trÆ°á»›c khi cháº¡y lá»‡nh ADB',
      'tags', jsonb_build_array('approval', 'adb', 'sensitive'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'approval_before_adb',
          'name', 'Approval Before ADB',
          'description', 'YÃªu cáº§u phÃª duyá»‡t trÆ°á»›c khi cháº¡y lá»‡nh ADB',
          'tags', jsonb_build_array('approval', 'adb', 'sensitive')
        ),
        'inputs', jsonb_build_object(
          'adbCommand', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 20000, 'maxRetries', 0, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'approval_1', 'type', 'approval_checkpoint', 'params', jsonb_build_object('reason', 'ADB command requires manual approval')),
          jsonb_build_object('id', 'adb_1', 'type', 'adb', 'params', jsonb_build_object('command', '{{adbCommand}}'), 'policy', jsonb_build_object('requiresApproval', true)),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 1000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 7. Run AutoX With Approval
    jsonb_build_object(
      'key', 'run_autox_with_approval',
      'name', 'Run AutoX With Approval',
      'description', 'Cháº¡y AutoX.js sau khi Ä‘Æ°á»£c phÃª duyá»‡t',
      'tags', jsonb_build_array('autox', 'approval', 'script'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'run_autox_with_approval',
          'name', 'Run AutoX With Approval',
          'description', 'Cháº¡y AutoX.js sau khi Ä‘Æ°á»£c phÃª duyá»‡t',
          'tags', jsonb_build_array('autox', 'approval', 'script')
        ),
        'inputs', jsonb_build_object(
          'filePath', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 30000, 'maxRetries', 0, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'approval_1', 'type', 'approval_checkpoint', 'params', jsonb_build_object('reason', 'Execute AutoX.js requires manual review')),
          jsonb_build_object('id', 'autox_1', 'type', 'run_autox', 'params', jsonb_build_object('filePath', '{{filePath}}'), 'policy', jsonb_build_object('requiresApproval', true)),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 4000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 8. Settings Smoke Test
    jsonb_build_object(
      'key', 'settings_smoke_test',
      'name', 'Settings Smoke Test',
      'description', 'Má»Ÿ Settings, kiá»ƒm tra package Ä‘Ãºng, chá»¥p mÃ n hÃ¬nh',
      'tags', jsonb_build_array('settings', 'smoke-test', 'qa'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'settings_smoke_test',
          'name', 'Settings Smoke Test',
          'description', 'Má»Ÿ Settings, kiá»ƒm tra package Ä‘Ãºng, chá»¥p mÃ n hÃ¬nh',
          'tags', jsonb_build_array('settings', 'smoke-test', 'qa')
        ),
        'inputs', jsonb_build_object(),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 12000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', 'settings')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object()),
          jsonb_build_object(
            'id', 'if_1',
            'type', 'conditional',
            'params', jsonb_build_object('left', '{{steps.current_1.output.appPackage}}', 'operator', 'contains', 'right', 'settings'),
            'then', jsonb_build_array(
              jsonb_build_object('id', 'screen_ok', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
            ),
            'else', jsonb_build_array(
              jsonb_build_object('id', 'stop_fail', 'type', 'stop', 'params', jsonb_build_object('reason', 'Settings app was not detected'))
            )
          )
        )
      )
    ),
    -- 9. Simple Form Fill Demo
    jsonb_build_object(
      'key', 'simple_form_fill_demo',
      'name', 'Simple Form Fill Demo',
      'description', 'Äiá»n 2 Ã´ nháº­p liá»‡u demo rá»“i chá»¥p mÃ n hÃ¬nh',
      'tags', jsonb_build_array('form', 'input', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'simple_form_fill_demo',
          'name', 'Simple Form Fill Demo',
          'description', 'Äiá»n 2 Ã´ nháº­p liá»‡u demo rá»“i chá»¥p mÃ n hÃ¬nh',
          'tags', jsonb_build_array('form', 'input', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true),
          'firstValue', jsonb_build_object('type', 'string', 'required', true),
          'secondValue', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 15000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'tap_1', 'type', 'tap', 'params', jsonb_build_object('x', 0.5, 'y', 0.28)),
          jsonb_build_object('id', 'input_1', 'type', 'input_text', 'params', jsonb_build_object('text', '{{firstValue}}')),
          jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 700)),
          jsonb_build_object('id', 'tap_2', 'type', 'tap', 'params', jsonb_build_object('x', 0.5, 'y', 0.42)),
          jsonb_build_object('id', 'input_2', 'type', 'input_text', 'params', jsonb_build_object('text', '{{secondValue}}')),
          jsonb_build_object('id', 'wait_3', 'type', 'wait', 'params', jsonb_build_object('ms', 1000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 10. Grouped Demo Sequence
    jsonb_build_object(
      'key', 'grouped_demo_sequence',
      'name', 'Grouped Demo Sequence',
      'description', 'Macro nhÃ³m step: má»Ÿ app, thao tÃ¡c nháº¹, chá»¥p mÃ n hÃ¬nh',
      'tags', jsonb_build_array('group', 'sequence', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'grouped_demo_sequence',
          'name', 'Grouped Demo Sequence',
          'description', 'Macro nhÃ³m step: má»Ÿ app, thao tÃ¡c nháº¹, chá»¥p mÃ n hÃ¬nh',
          'tags', jsonb_build_array('group', 'sequence', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 20000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object(
            'id', 'group_1',
            'type', 'group',
            'params', jsonb_build_object('name', 'launch_and_navigate'),
            'steps', jsonb_build_array(
              jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
              jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
              jsonb_build_object('id', 'tap_1', 'type', 'tap', 'params', jsonb_build_object('x', 0.85, 'y', 0.92)),
              jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 1200)),
              jsonb_build_object('id', 'swipe_1', 'type', 'swipe', 'params', jsonb_build_object('fromX', 0.5, 'fromY', 0.75, 'toX', 0.5, 'toY', 0.35))
            )
          ),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object()),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    )
  ];

  -- Process each macro
  FOREACH macro_data IN ARRAY all_macros
  LOOP
    -- Upsert macro by key
    INSERT INTO macros (key, name, description, created_by_user_id, created_at, updated_at)
    VALUES (
      macro_data->>'key',
      macro_data->>'name',
      macro_data->>'description',
      admin_user_id,
      now(),
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING * INTO macro_record;

    -- Check if this is a new macro or update
    IF macro_record.created_at >= now() - interval '1 second' THEN
      inserted_count := inserted_count + 1;
    ELSE
      updated_count := updated_count + 1;
    END IF;

    -- Upsert macro version (version 1)
    INSERT INTO macro_versions (
      macro_id,
      version_number,
      status,
      definition_json,
      input_schema_json,
      tags_json,
      created_by_user_id,
      created_at
    )
    VALUES (
      macro_record.id,
      1,
      'ACTIVE',
      macro_data->'definition',
      macro_data->'definition'->'inputs',
      macro_data->'tags',
      admin_user_id,
      now()
    )
    ON CONFLICT (macro_id, version_number) DO UPDATE
    SET
      status = 'ACTIVE',
      definition_json = EXCLUDED.definition_json,
      input_schema_json = EXCLUDED.input_schema_json,
      tags_json = EXCLUDED.tags_json
    RETURNING * INTO version_record;

    -- Update macro's latest_version_id
    UPDATE macros
    SET latest_version_id = version_record.id
    WHERE id = macro_record.id;
  END LOOP;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count,
    'timestamp', now()
  );
END;
$$;

-- ==========================================================================
-- Migration: 20260323135517_add_device_locks_update_policy.sql
-- ==========================================================================

/*
  # Add UPDATE policy on device_locks

  1. Security Changes
    - Add UPDATE policy for operators and admins to renew device locks
    - Required for lock renewal during long-running workflow executions
*/

CREATE POLICY "Operators and admins can update device locks"
  ON device_locks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('ADMIN', 'OPERATOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('ADMIN', 'OPERATOR')
    )
  );

-- ==========================================================================
-- Migration: 20260323135706_fix_seed_macros_function.sql
-- ==========================================================================

/*
  # Fix seed_demo_macros function

  1. Changes
    - Add unique index on macro_versions(macro_id, version_number) for upsert
    - Replace broken seed_demo_macros() function
      - Fix: was querying non-existent `users` table, now uses `profiles`
      - Fix: was checking for ADMIN role only, now falls back to any authenticated user
      - Fix: add explicit `public.` schema prefix for all table references
      - Fix: set search_path to public for correct resolution

  2. Notes
    - Function is called from frontend "Load Samples" button
    - Idempotent: safe to run multiple times
    - Returns JSON summary with inserted/updated counts
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_macro_versions_macro_version
  ON public.macro_versions (macro_id, version_number);

CREATE OR REPLACE FUNCTION public.seed_demo_macros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  owner_id uuid;
  inserted_count int := 0;
  updated_count int := 0;
  macro_record record;
  version_record record;
  macro_data jsonb;
  all_macros jsonb[];
BEGIN
  SELECT id INTO owner_id
  FROM public.profiles
  WHERE role = 'ADMIN'
  LIMIT 1;

  IF owner_id IS NULL THEN
    SELECT id INTO owner_id
    FROM public.profiles
    LIMIT 1;
  END IF;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'No user profile found. Please sign in first.';
  END IF;

  all_macros := ARRAY[
    jsonb_build_object(
      'key', 'launch_app_and_capture',
      'name', 'Launch App And Capture',
      'description', 'Launch app, wait, capture screenshot, get current app info',
      'tags', '["basic","screenshot","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"launch_app_and_capture","name":"Launch App And Capture","tags":["basic","screenshot","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":10000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}},
          {"id":"current_1","type":"get_current_app","params":{}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'input_text_demo',
      'name', 'Input Text Demo',
      'description', 'Open app, tap input field, type text, capture screenshot',
      'tags', '["input","demo","ui"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"input_text_demo","name":"Input Text Demo","tags":["input","demo","ui"]},
        "inputs":{"appName":{"type":"string","required":true},"textValue":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"tap_1","type":"tap","params":{"x":0.5,"y":0.3}},
          {"id":"wait_2","type":"wait","params":{"ms":800}},
          {"id":"input_1","type":"input_text","params":{"text":"{{textValue}}"}},
          {"id":"wait_3","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'open_and_swipe_feed',
      'name', 'Open And Swipe Feed',
      'description', 'Open app and swipe feed multiple times to verify UI',
      'tags', '["swipe","feed","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"open_and_swipe_feed","name":"Open And Swipe Feed","tags":["swipe","feed","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"swipe_1","type":"swipe","params":{"fromX":0.5,"fromY":0.8,"toX":0.5,"toY":0.25}},
          {"id":"wait_2","type":"wait","params":{"ms":1200}},
          {"id":"swipe_2","type":"swipe","params":{"fromX":0.5,"fromY":0.8,"toX":0.5,"toY":0.25}},
          {"id":"wait_3","type":"wait","params":{"ms":1200}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'current_app_guard',
      'name', 'Current App Guard',
      'description', 'Check current app - screenshot if match, stop if mismatch',
      'tags', '["guard","conditional","validation"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"current_app_guard","name":"Current App Guard","tags":["guard","conditional","validation"]},
        "inputs":{"appName":{"type":"string","required":true},"expectedPackage":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.output.appPackage}}","operator":"equals","right":"{{expectedPackage}}"},
           "then":[{"id":"screen_ok","type":"screenshot","params":{"saveToArtifact":true}}],
           "else":[{"id":"stop_fail","type":"stop","params":{"reason":"Current package does not match expectedPackage"}}]}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'multi_device_launch_check',
      'name', 'Multi Device Launch Check',
      'description', 'Run the same flow on multiple devices simultaneously',
      'tags', '["multi-device","batch","monitoring"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"multi_device_launch_check","name":"Multi Device Launch Check","tags":["multi-device","batch","monitoring"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"multi_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"continue"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}},
          {"id":"current_1","type":"get_current_app","params":{}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'approval_before_adb',
      'name', 'Approval Before ADB',
      'description', 'Requires approval before executing ADB command',
      'tags', '["approval","adb","sensitive"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"approval_before_adb","name":"Approval Before ADB","tags":["approval","adb","sensitive"]},
        "inputs":{"adbCommand":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"approval_1","type":"approval_checkpoint","params":{"reason":"ADB command requires manual approval"}},
          {"id":"adb_1","type":"adb","params":{"command":"{{adbCommand}}"},"policy":{"requiresApproval":true}},
          {"id":"wait_1","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'run_autox_with_approval',
      'name', 'Run AutoX With Approval',
      'description', 'Execute AutoX.js script after approval',
      'tags', '["autox","approval","script"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"run_autox_with_approval","name":"Run AutoX With Approval","tags":["autox","approval","script"]},
        "inputs":{"filePath":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":30000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"approval_1","type":"approval_checkpoint","params":{"reason":"Execute AutoX.js requires manual review"}},
          {"id":"autox_1","type":"run_autox","params":{"filePath":"{{filePath}}"},"policy":{"requiresApproval":true}},
          {"id":"wait_1","type":"wait","params":{"ms":4000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'settings_smoke_test',
      'name', 'Settings Smoke Test',
      'description', 'Open Settings, verify correct package, capture screenshot',
      'tags', '["settings","smoke-test","qa"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"settings_smoke_test","name":"Settings Smoke Test","tags":["settings","smoke-test","qa"]},
        "inputs":{},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"settings"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.output.appPackage}}","operator":"contains","right":"settings"},
           "then":[{"id":"screen_ok","type":"screenshot","params":{"saveToArtifact":true}}],
           "else":[{"id":"stop_fail","type":"stop","params":{"reason":"Settings app was not detected"}}]}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'simple_form_fill_demo',
      'name', 'Simple Form Fill Demo',
      'description', 'Fill two input fields then capture screenshot',
      'tags', '["form","input","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"simple_form_fill_demo","name":"Simple Form Fill Demo","tags":["form","input","demo"]},
        "inputs":{"appName":{"type":"string","required":true},"firstValue":{"type":"string","required":true},"secondValue":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"tap_1","type":"tap","params":{"x":0.5,"y":0.28}},
          {"id":"input_1","type":"input_text","params":{"text":"{{firstValue}}"}},
          {"id":"wait_2","type":"wait","params":{"ms":700}},
          {"id":"tap_2","type":"tap","params":{"x":0.5,"y":0.42}},
          {"id":"input_2","type":"input_text","params":{"text":"{{secondValue}}"}},
          {"id":"wait_3","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'grouped_demo_sequence',
      'name', 'Grouped Demo Sequence',
      'description', 'Grouped steps: open app, navigate, capture screenshot',
      'tags', '["group","sequence","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"grouped_demo_sequence","name":"Grouped Demo Sequence","tags":["group","sequence","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"group_1","type":"group","params":{"name":"launch_and_navigate"},"steps":[
            {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
            {"id":"wait_1","type":"wait","params":{"ms":2500}},
            {"id":"tap_1","type":"tap","params":{"x":0.85,"y":0.92}},
            {"id":"wait_2","type":"wait","params":{"ms":1200}},
            {"id":"swipe_1","type":"swipe","params":{"fromX":0.5,"fromY":0.75,"toX":0.5,"toY":0.35}}
          ]},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    )
  ];

  FOREACH macro_data IN ARRAY all_macros
  LOOP
    INSERT INTO public.macros (key, name, description, created_by_user_id, created_at, updated_at)
    VALUES (
      macro_data->>'key',
      macro_data->>'name',
      macro_data->>'description',
      owner_id,
      now(),
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING * INTO macro_record;

    IF macro_record.created_at >= now() - interval '1 second' THEN
      inserted_count := inserted_count + 1;
    ELSE
      updated_count := updated_count + 1;
    END IF;

    INSERT INTO public.macro_versions (
      macro_id, version_number, status,
      definition_json, input_schema_json, tags_json,
      created_by_user_id, created_at
    )
    VALUES (
      macro_record.id, 1, 'ACTIVE',
      macro_data->'definition',
      macro_data->'definition'->'inputs',
      macro_data->'tags',
      owner_id, now()
    )
    ON CONFLICT (macro_id, version_number) DO UPDATE
    SET
      status = 'ACTIVE',
      definition_json = EXCLUDED.definition_json,
      input_schema_json = EXCLUDED.input_schema_json,
      tags_json = EXCLUDED.tags_json
    RETURNING * INTO version_record;

    UPDATE public.macros
    SET latest_version_id = version_record.id
    WHERE id = macro_record.id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count,
    'timestamp', now()
  );
END;
$$;

-- ==========================================================================
-- Migration: 20260429073431_fix_conditional_step_template_format.sql
-- ==========================================================================

/*
  # Fix conditional step template variable format in seeded macro definitions

  ## Problem
  Seeded macro definitions used {{steps.step_id.output.fieldName}} template format,
  but the WorkflowRunner's resolver (resolver.ts) reads step outputs directly from
  the stepOutputs Map, where values are the raw output objects (not wrapped in {output: ...}).
  The correct format is {{steps.step_id.fieldName}}.

  ## Changes
  - Updates definition_json in macro_versions to replace the wrong template format
    with the correct one for all affected conditional step params.
*/

UPDATE macro_versions
SET definition_json = REPLACE(
  definition_json::text,
  '{{steps.current_1.output.appPackage}}',
  '{{steps.current_1.appPackage}}'
)::jsonb
WHERE definition_json::text LIKE '%steps.current_1.output.appPackage%';

UPDATE macro_versions
SET definition_json = REPLACE(
  definition_json::text,
  '{{steps.get_app.output.appPackage}}',
  '{{steps.get_app.appPackage}}'
)::jsonb
WHERE definition_json::text LIKE '%steps.get_app.output.appPackage%';

-- ==========================================================================
-- Migration: 20260429075058_fix_seed_demo_macros_template_format.sql
-- ==========================================================================

/*
  # Fix seed_demo_macros() â€” correct conditional step template variable format

  ## Problem
  The seed_demo_macros() function contained conditional step params using
  {{steps.current_1.output.appPackage}} which is invalid for the WorkflowRunner
  resolver. The correct format is {{steps.current_1.appPackage}} (no .output layer).

  ## Changes
  - Replaces the seed_demo_macros() function body with corrected template strings
    for current_app_guard and settings_smoke_test macro definitions.
  - All other macro definitions are unchanged.
*/

CREATE OR REPLACE FUNCTION public.seed_demo_macros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  owner_id uuid;
  inserted_count int := 0;
  updated_count int := 0;
  macro_data jsonb;
  existing_macro_id uuid;
  existing_version_id uuid;
  new_macro_id uuid;
  new_version_id uuid;
  macro_list jsonb[] := ARRAY[
    jsonb_build_object(
      'key', 'launch_app_and_capture',
      'name', 'Launch App And Capture',
      'description', 'Open an app, wait a few seconds, take a screenshot, get current app info',
      'tags', '["basic","screenshot","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"launch_app_and_capture","name":"Launch App And Capture","tags":["basic","screenshot","demo"]},
        "inputs":{"appName":{"type":"string","required":true,"description":"App package name to launch"}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":10000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}},
          {"id":"current_1","type":"get_current_app","params":{}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'input_text_demo',
      'name', 'Input Text Demo',
      'description', 'Open app, tap input area, type text, screenshot',
      'tags', '["input","demo","ui"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"input_text_demo","name":"Input Text Demo","tags":["input","demo","ui"]},
        "inputs":{"appName":{"type":"string","required":true},"textValue":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"tap_1","type":"tap","params":{"x":0.5,"y":0.3}},
          {"id":"wait_2","type":"wait","params":{"ms":800}},
          {"id":"input_1","type":"input_text","params":{"text":"{{textValue}}"}},
          {"id":"wait_3","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'open_and_swipe_feed',
      'name', 'Open And Swipe Feed',
      'description', 'Open app and swipe through feed to test UI scrolling',
      'tags', '["swipe","feed","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"open_and_swipe_feed","name":"Open And Swipe Feed","tags":["swipe","feed","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"swipe_1","type":"swipe","params":{"fromX":0.5,"fromY":0.8,"toX":0.5,"toY":0.25}},
          {"id":"wait_2","type":"wait","params":{"ms":1200}},
          {"id":"swipe_2","type":"swipe","params":{"fromX":0.5,"fromY":0.8,"toX":0.5,"toY":0.25}},
          {"id":"wait_3","type":"wait","params":{"ms":1200}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'current_app_guard',
      'name', 'Current App Guard',
      'description', 'Check current app matches expected, screenshot if match, stop if not',
      'tags', '["guard","conditional","validation"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"current_app_guard","name":"Current App Guard","tags":["guard","conditional","validation"]},
        "inputs":{"appName":{"type":"string","required":true},"expectedPackage":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.appPackage}}","operator":"equals","right":"{{expectedPackage}}"},
           "then":[{"id":"screen_ok","type":"screenshot","params":{"saveToArtifact":true}}],
           "else":[{"id":"stop_fail","type":"stop","params":{"reason":"Current package does not match expectedPackage"}}]}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'multi_device_launch_check',
      'name', 'Multi Device Launch Check',
      'description', 'Run the same flow on multiple devices simultaneously',
      'tags', '["multi-device","batch","monitoring"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"multi_device_launch_check","name":"Multi Device Launch Check","tags":["multi-device","batch","monitoring"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"multi_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"continue"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}},
          {"id":"current_1","type":"get_current_app","params":{}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'approval_before_adb',
      'name', 'Approval Before ADB',
      'description', 'Requires approval before executing ADB command',
      'tags', '["approval","adb","sensitive"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"approval_before_adb","name":"Approval Before ADB","tags":["approval","adb","sensitive"]},
        "inputs":{"adbCommand":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"approval_1","type":"approval_checkpoint","params":{"reason":"ADB command requires manual approval"}},
          {"id":"adb_1","type":"adb","params":{"command":"{{adbCommand}}"},"policy":{"requiresApproval":true}},
          {"id":"wait_1","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'run_autox_with_approval',
      'name', 'Run AutoX With Approval',
      'description', 'Execute AutoX.js script after approval',
      'tags', '["autox","approval","script"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"run_autox_with_approval","name":"Run AutoX With Approval","tags":["autox","approval","script"]},
        "inputs":{"filePath":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":30000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"approval_1","type":"approval_checkpoint","params":{"reason":"Execute AutoX.js requires manual review"}},
          {"id":"autox_1","type":"run_autox","params":{"filePath":"{{filePath}}"},"policy":{"requiresApproval":true}},
          {"id":"wait_1","type":"wait","params":{"ms":4000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'settings_smoke_test',
      'name', 'Settings Smoke Test',
      'description', 'Open Settings, verify correct package, capture screenshot',
      'tags', '["settings","smoke-test","qa"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"settings_smoke_test","name":"Settings Smoke Test","tags":["settings","smoke-test","qa"]},
        "inputs":{},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"settings"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.appPackage}}","operator":"contains","right":"settings"},
           "then":[{"id":"screen_ok","type":"screenshot","params":{"saveToArtifact":true}}],
           "else":[{"id":"stop_fail","type":"stop","params":{"reason":"Settings app was not detected"}}]}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'simple_form_fill_demo',
      'name', 'Simple Form Fill Demo',
      'description', 'Fill two input fields then capture screenshot',
      'tags', '["form","input","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"simple_form_fill_demo","name":"Simple Form Fill Demo","tags":["form","input","demo"]},
        "inputs":{"appName":{"type":"string","required":true},"firstValue":{"type":"string","required":true},"secondValue":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"tap_1","type":"tap","params":{"x":0.5,"y":0.28}},
          {"id":"input_1","type":"input_text","params":{"text":"{{firstValue}}"}},
          {"id":"wait_2","type":"wait","params":{"ms":700}},
          {"id":"tap_2","type":"tap","params":{"x":0.5,"y":0.42}},
          {"id":"input_2","type":"input_text","params":{"text":"{{secondValue}}"}},
          {"id":"wait_3","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'grouped_demo_sequence',
      'name', 'Grouped Demo Sequence',
      'description', 'Grouped steps: launch app, light interactions, screenshot',
      'tags', '["group","sequence","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"grouped_demo_sequence","name":"Grouped Demo Sequence","tags":["group","sequence","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"group_1","type":"group","params":{"name":"launch_and_navigate"},
           "steps":[
             {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
             {"id":"wait_1","type":"wait","params":{"ms":2500}},
             {"id":"tap_1","type":"tap","params":{"x":0.85,"y":0.92}},
             {"id":"wait_2","type":"wait","params":{"ms":1200}},
             {"id":"swipe_1","type":"swipe","params":{"fromX":0.5,"fromY":0.75,"toX":0.5,"toY":0.35}}
           ]},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    )
  ];
BEGIN
  SELECT id INTO owner_id FROM public.profiles LIMIT 1;
  IF owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profiles found');
  END IF;

  FOREACH macro_data IN ARRAY macro_list LOOP
    SELECT id INTO existing_macro_id
      FROM public.macros WHERE key = macro_data->>'key';

    IF existing_macro_id IS NULL THEN
      INSERT INTO public.macros (key, name, description, created_by_user_id)
      VALUES (
        macro_data->>'key',
        macro_data->>'name',
        macro_data->>'description',
        owner_id
      )
      RETURNING id INTO new_macro_id;

      INSERT INTO public.macro_versions (
        macro_id, version_number, status,
        definition_json, input_schema_json, tags_json, created_by_user_id
      ) VALUES (
        new_macro_id, 1, 'ACTIVE',
        macro_data->'definition',
        COALESCE(macro_data->'definition'->'inputs', '{}'::jsonb),
        COALESCE(macro_data->'tags', '[]'::jsonb),
        owner_id
      )
      RETURNING id INTO new_version_id;

      UPDATE public.macros SET latest_version_id = new_version_id WHERE id = new_macro_id;
      inserted_count := inserted_count + 1;
    ELSE
      SELECT id INTO existing_version_id
        FROM public.macro_versions
        WHERE macro_id = existing_macro_id AND version_number = 1;

      IF existing_version_id IS NOT NULL THEN
        UPDATE public.macro_versions SET
          definition_json = macro_data->'definition',
          input_schema_json = COALESCE(macro_data->'definition'->'inputs', '{}'::jsonb),
          tags_json = COALESCE(macro_data->'tags', '[]'::jsonb),
          status = 'ACTIVE'
        WHERE id = existing_version_id;

        UPDATE public.macros SET
          name = macro_data->>'name',
          description = macro_data->>'description',
          latest_version_id = existing_version_id
        WHERE id = existing_macro_id;

        updated_count := updated_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$;

-- ==========================================================================
-- Migration: 20260504114000_add_workflow_run_execution_leases.sql
-- ==========================================================================

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS execution_owner text,
  ADD COLUMN IF NOT EXISTS execution_claim_token text,
  ADD COLUMN IF NOT EXISTS execution_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wr_execution_lease
  ON workflow_runs(status, execution_lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_wr_execution_owner
  ON workflow_runs(execution_owner, execution_claim_token);

-- ==========================================================================
-- Migration: 20260504153000_add_device_health_persistence_fields.sql
-- ==========================================================================

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS heartbeat_freshness text NOT NULL DEFAULT 'offline'
    CHECK (heartbeat_freshness IN ('fresh', 'stale', 'offline')),
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

UPDATE public.devices
SET heartbeat_freshness = CASE
  WHEN status = 'OFFLINE' OR last_seen_at IS NULL THEN 'offline'
  ELSE 'fresh'
END
WHERE heartbeat_freshness = 'offline';

CREATE INDEX IF NOT EXISTS idx_devices_heartbeat_freshness ON public.devices(heartbeat_freshness);
