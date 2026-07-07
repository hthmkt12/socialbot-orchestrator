ALTER TABLE execution_profiles
  ADD COLUMN IF NOT EXISTS target_failure_policy text NOT NULL DEFAULT 'skip_failed_target'
    CHECK (target_failure_policy IN ('fail_fast', 'skip_failed_target'));
