/*
  # Social Media Account Lifecycle

  1. New Tables
    - `accounts` - Social media accounts with warm-up tracking and action limits
    - `account_action_history` - Per-action audit trail for rate limiting + analytics

  2. Security
    - RLS enabled on both tables
    - Users can CRUD their own accounts
    - Admins can manage all accounts
    - Action history is read-only after insert

  3. Indexes
    - accounts: user_id + platform for team filtering
    - accounts: is_blocked for failover queries
    - account_action_history: account_id + created_at for rate limit checks
    - account_action_history: created_at for analytics aggregation
*/

-- Account lifecycle tracking
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  username text NOT NULL,
  encrypted_password text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  warm_up_started_at timestamptz,
  warm_up_stage int NOT NULL DEFAULT 1 CHECK (warm_up_stage >= 1),
  daily_action_limit int NOT NULL DEFAULT 100 CHECK (daily_action_limit >= 0),
  current_action_count int NOT NULL DEFAULT 0 CHECK (current_action_count >= 0),
  last_action_reset_at timestamptz,
  is_blocked boolean NOT NULL DEFAULT false,
  detected_block_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE accounts IS 'Social media accounts managed through the platform';
COMMENT ON COLUMN accounts.warm_up_stage IS '1=inactive, 2-4=gradual ramp, 5=full speed';
COMMENT ON COLUMN accounts.daily_action_limit IS 'Max automated actions per day';
COMMENT ON COLUMN accounts.current_action_count IS 'Actions performed since last reset';
COMMENT ON COLUMN accounts.last_action_reset_at IS 'When current_action_count was last reset to 0';
COMMENT ON COLUMN accounts.is_blocked IS 'True if platform detected automation and blocked the account';

-- Action history for rate limiting + analytics
CREATE TABLE IF NOT EXISTS account_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('like', 'follow', 'comment', 'post', 'share')),
  step_id uuid REFERENCES run_steps(id) ON DELETE SET NULL,
  success boolean,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE account_action_history IS 'Audit trail of automated actions per account';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_platform ON accounts(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_accounts_blocked ON accounts(is_blocked) WHERE is_blocked = true;
CREATE INDEX IF NOT EXISTS idx_account_hist_account_created ON account_action_history(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_hist_created ON account_action_history(created_at);

-- RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_action_history ENABLE ROW LEVEL SECURITY;

-- Accounts: users can read own accounts
CREATE POLICY "Users can read own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Accounts: users can create own accounts
CREATE POLICY "Users can create own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Accounts: users can update own accounts
CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Accounts: users can delete own accounts
CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Accounts: admins can manage all accounts
CREATE POLICY "Admins can manage all accounts"
  ON accounts ALL
  TO authenticated
  USING (get_user_role() = 'ADMIN')
  WITH CHECK (get_user_role() = 'ADMIN');

-- Action history: users can read history of own accounts
CREATE POLICY "Users can read own account history"
  ON account_action_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_action_history.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Action history: insert allowed (by worker or system)
CREATE POLICY "Authenticated can insert action history"
  ON account_action_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Action history: admins can read all
CREATE POLICY "Admins can read all action history"
  ON account_action_history FOR SELECT
  TO authenticated
  USING (get_user_role() = 'ADMIN');
