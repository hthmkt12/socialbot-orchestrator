/*
  # Credential Boundary Metadata (Phase A - Schema Preparation)

  Backward-compatible schema additions for the production credential boundary.
  No Edge Function, no UI behavior change, no worker decrypt behavior change,
  and no plaintext credential column is introduced in this migration.

  1. New Columns (all nullable, no NOT NULL constraints)
    - credential_policy_status  text        - lifecycle status of the credential policy
    - credential_key_version    int         - encryption key version for rotation tracking
    - credential_rotated_at     timestamptz - timestamp of the last key rotation

  2. CHECK Constraint
    - credential_policy_status must be one of:
      pilot_client_encrypted | server_boundary_required | server_managed | migration_pending

  3. Backfill
    - Existing rows whose encrypted_password starts with 'v2:' are stamped
      with credential_policy_status = 'pilot_client_encrypted'.
    - No encrypted_password values are modified.

  4. No plaintext password column is added.
*/

-- Add nullable credential boundary metadata columns
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS credential_policy_status text,
  ADD COLUMN IF NOT EXISTS credential_key_version int,
  ADD COLUMN IF NOT EXISTS credential_rotated_at timestamptz;

-- CHECK constraint on credential_policy_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_credential_policy_status_check'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_credential_policy_status_check
      CHECK (
        credential_policy_status IS NULL
        OR credential_policy_status IN (
          'pilot_client_encrypted',
          'server_boundary_required',
          'server_managed',
          'migration_pending'
        )
      );
  END IF;
END $$;

-- Backfill: stamp existing v2-encrypted rows as pilot_client_encrypted.
-- No encrypted_password values are touched.
UPDATE accounts
  SET credential_policy_status = 'pilot_client_encrypted'
  WHERE credential_policy_status IS NULL
    AND encrypted_password LIKE 'v2:%';

-- Column comments
COMMENT ON COLUMN accounts.credential_policy_status IS
  'Lifecycle status of the credential policy: pilot_client_encrypted, server_boundary_required, server_managed, or migration_pending. NULL for rows not yet classified.';
COMMENT ON COLUMN accounts.credential_key_version IS
  'Encryption key version used for this account credential, for rotation tracking. NULL until a rotation has been performed.';
COMMENT ON COLUMN accounts.credential_rotated_at IS
  'Timestamp of the most recent credential key rotation for this account. NULL until a rotation has been performed.';

-- ============================================================================
-- Rollback SQL (run manually to revert this migration)
-- ============================================================================
-- ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_credential_policy_status_check;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS credential_rotated_at;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS credential_key_version;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS credential_policy_status;
-- ============================================================================
