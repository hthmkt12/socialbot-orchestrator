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
