/*
  # Seed Data: Default Execution Profile

  1. Data
    - Default execution profile for workflow runs
      - 1 concurrent run per device
      - 10s timeout
      - 2 max retries
      - Requires approval for ADB and AutoX commands

  2. Notes
    - This provides a sensible default configuration
    - Admins can create additional profiles from the UI
*/

INSERT INTO execution_profiles (name, description, concurrency_per_device, default_timeout_ms, max_retries, require_approval_for_adb, require_approval_for_autox)
VALUES (
  'Default',
  'Default execution profile with standard safety settings',
  1,
  10000,
  2,
  true,
  true
)
ON CONFLICT DO NOTHING;