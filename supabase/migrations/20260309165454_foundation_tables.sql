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