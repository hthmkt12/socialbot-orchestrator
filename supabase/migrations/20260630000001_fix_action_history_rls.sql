-- Fix: restrict account_action_history INSERT to own accounts only.
-- Previous policy allowed any authenticated user to insert for any account.

DROP POLICY IF EXISTS "Authenticated can insert action history" ON account_action_history;

CREATE POLICY "Users can insert action history for own accounts"
  ON account_action_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_action_history.account_id
        AND accounts.user_id = auth.uid()
    )
  );
