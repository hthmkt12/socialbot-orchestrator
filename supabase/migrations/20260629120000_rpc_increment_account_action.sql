-- Create an RPC to atomically increment the current_action_count for an account
CREATE OR REPLACE FUNCTION increment_account_action_count(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.accounts
  SET 
    current_action_count = COALESCE(current_action_count, 0) + 1,
    updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;
