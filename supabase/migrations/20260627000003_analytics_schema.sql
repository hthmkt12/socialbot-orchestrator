-- Account analytics tracking
CREATE TABLE account_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT current_date,
  followers_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  engagement_rate numeric(5,2),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(account_id, snapshot_date)
);

ALTER TABLE account_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account analytics"
  ON account_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_analytics.account_id
      AND accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own account analytics"
  ON account_analytics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = account_analytics.account_id
      AND accounts.user_id = auth.uid()
    )
  );

-- Function to calculate followers gained over last 30 days
CREATE OR REPLACE FUNCTION get_account_growth(p_account_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (
  followers_gained integer,
  avg_engagement numeric
) AS $$
DECLARE
  v_oldest_followers integer;
  v_newest_followers integer;
BEGIN
  -- Get oldest within window
  SELECT followers_count INTO v_oldest_followers
  FROM account_analytics
  WHERE account_id = p_account_id
    AND snapshot_date >= current_date - p_days
  ORDER BY snapshot_date ASC
  LIMIT 1;

  -- Get newest
  SELECT followers_count INTO v_newest_followers
  FROM account_analytics
  WHERE account_id = p_account_id
  ORDER BY snapshot_date DESC
  LIMIT 1;

  RETURN QUERY SELECT 
    COALESCE(v_newest_followers - v_oldest_followers, 0) as followers_gained,
    COALESCE(AVG(engagement_rate), 0) as avg_engagement
  FROM account_analytics
  WHERE account_id = p_account_id
    AND snapshot_date >= current_date - p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
