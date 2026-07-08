-- First Instagram pilot workflow evidence history.
-- Keeps engagement budgets limited to existing actions while allowing a
-- pilot-safe open/capture evidence event to be tied back to a run and step id.

ALTER TABLE account_action_history
  ADD COLUMN IF NOT EXISTS source_run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_step_id text;

ALTER TABLE account_action_history
  DROP CONSTRAINT IF EXISTS account_action_history_action_type_check;

ALTER TABLE account_action_history
  ADD CONSTRAINT account_action_history_action_type_check
  CHECK (action_type IN ('like', 'follow', 'comment', 'post', 'share', 'instagram_pilot_open'));

CREATE INDEX IF NOT EXISTS idx_account_hist_source_run
  ON account_action_history(source_run_id);
