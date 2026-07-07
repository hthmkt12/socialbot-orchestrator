CREATE TABLE IF NOT EXISTS pilot_readiness_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backend text NOT NULL DEFAULT 'unknown'
    CHECK (backend IN ('mobile_mcp', 'laixi', 'ios_portal', 'unknown')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'pilot_verified', 'not_verified', 'needs_rerun')),
  report_path text,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_readiness_reports_status
  ON pilot_readiness_reports(status);

CREATE INDEX IF NOT EXISTS idx_pilot_readiness_reports_backend
  ON pilot_readiness_reports(backend);

ALTER TABLE pilot_readiness_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read readiness reports"
  ON pilot_readiness_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operators and admins can create readiness reports"
  ON pilot_readiness_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('OPERATOR', 'ADMIN')
    )
  );

CREATE POLICY "Operators and admins can update draft readiness reports"
  ON pilot_readiness_reports FOR UPDATE
  TO authenticated
  USING (
    status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('OPERATOR', 'ADMIN')
    )
  )
  WITH CHECK (
    status IN ('draft', 'submitted')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('OPERATOR', 'ADMIN')
    )
  );

CREATE POLICY "Admins can review readiness reports"
  ON pilot_readiness_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
  );
