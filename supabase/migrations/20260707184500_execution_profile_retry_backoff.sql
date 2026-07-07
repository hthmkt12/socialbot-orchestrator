ALTER TABLE execution_profiles
  ADD COLUMN IF NOT EXISTS retry_base_delay_ms integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS retry_max_delay_ms integer NOT NULL DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS retry_max_elapsed_ms integer NOT NULL DEFAULT 120000;

ALTER TABLE execution_profiles
  ADD CONSTRAINT execution_profiles_retry_base_delay_ms_check
    CHECK (retry_base_delay_ms >= 0 AND retry_base_delay_ms <= 300000),
  ADD CONSTRAINT execution_profiles_retry_max_delay_ms_check
    CHECK (retry_max_delay_ms >= 0 AND retry_max_delay_ms <= 300000),
  ADD CONSTRAINT execution_profiles_retry_max_elapsed_ms_check
    CHECK (retry_max_elapsed_ms >= 0 AND retry_max_elapsed_ms <= 3600000),
  ADD CONSTRAINT execution_profiles_retry_delay_order_check
    CHECK (retry_max_delay_ms >= retry_base_delay_ms);
