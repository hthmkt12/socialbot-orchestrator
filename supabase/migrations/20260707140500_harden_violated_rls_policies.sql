/*
  Harden RLS rules for violated anti-use cases:
  - Users must not self-assign roles through profiles updates.
  - Viewers must not manage social accounts through direct table access.
  - Viewers/authenticated users must not manage workflow schedules through direct table access.
*/

-- Profiles: allow admin role management, but block self role escalation/demotion.
CREATE OR REPLACE FUNCTION prevent_non_admin_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF get_user_role() = 'ADMIN' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Only admins can change profile roles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_non_admin_profile_role_change_trigger ON profiles;
CREATE TRIGGER prevent_non_admin_profile_role_change_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_non_admin_profile_role_change();

DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'ADMIN')
  WITH CHECK (get_user_role() = 'ADMIN');

-- Accounts: viewers may read their own rows, operators/admins may manage.
DROP POLICY IF EXISTS "Users can create own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
DROP POLICY IF EXISTS "Operators and admins can create own accounts" ON accounts;
DROP POLICY IF EXISTS "Operators and admins can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Operators and admins can delete own accounts" ON accounts;

CREATE POLICY "Operators and admins can create own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND get_user_role() IN ('ADMIN', 'OPERATOR'));

CREATE POLICY "Operators and admins can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND get_user_role() IN ('ADMIN', 'OPERATOR'))
  WITH CHECK (auth.uid() = user_id AND get_user_role() IN ('ADMIN', 'OPERATOR'));

CREATE POLICY "Operators and admins can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND get_user_role() IN ('ADMIN', 'OPERATOR'));

-- Workflow schedules: keep read access, restrict management to operators/admins.
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON workflow_schedules;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON workflow_schedules;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON workflow_schedules;
DROP POLICY IF EXISTS "Operators and admins can insert workflow schedules" ON workflow_schedules;
DROP POLICY IF EXISTS "Operators and admins can update workflow schedules" ON workflow_schedules;
DROP POLICY IF EXISTS "Operators and admins can delete workflow schedules" ON workflow_schedules;

CREATE POLICY "Operators and admins can insert workflow schedules"
  ON workflow_schedules FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('ADMIN', 'OPERATOR'));

CREATE POLICY "Operators and admins can update workflow schedules"
  ON workflow_schedules FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'OPERATOR'))
  WITH CHECK (get_user_role() IN ('ADMIN', 'OPERATOR'));

CREATE POLICY "Operators and admins can delete workflow schedules"
  ON workflow_schedules FOR DELETE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'OPERATOR'));
