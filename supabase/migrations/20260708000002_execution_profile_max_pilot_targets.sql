ALTER TABLE execution_profiles
  ADD COLUMN IF NOT EXISTS max_pilot_target_count integer NOT NULL DEFAULT 5
    CHECK (max_pilot_target_count BETWEEN 1 AND 10);
