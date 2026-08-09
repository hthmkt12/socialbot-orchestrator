/*
  Close VIEW-NO-007: viewers must not read audit logs.
  Operators retain access to their own events; admins retain all-event access
  through the existing admin policy.
*/

DROP POLICY IF EXISTS "Operators can read own audit logs" ON audit_logs;

CREATE POLICY "Operators can read own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    get_user_role() = 'OPERATOR'
    AND actor_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
