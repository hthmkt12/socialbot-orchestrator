-- Note: artifacts table ALREADY HAS a storage_key column!
-- export interface Artifact {
--   id: string;
--   workflow_run_id: string;
--   device_id: string | null;
--   type: ArtifactType;
--   storage_key: string;
--   content_type: string;
--   size: number;
--   metadata_json: Record<string, unknown>;
--   created_at: string;
-- }

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('artifacts', 'artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- storage_key format is typically just a UUID or path. We will enforce that the user has access to the artifact via the artifacts table.
-- Supabase allows querying public tables from storage policies.

CREATE POLICY "Users can upload their own artifacts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'artifacts' AND 
    EXISTS (
      SELECT 1 FROM artifacts a
      JOIN workflow_runs r ON r.id = a.workflow_run_id
      WHERE a.storage_key = name
      AND r.triggered_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own artifacts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'artifacts' AND 
    EXISTS (
      SELECT 1 FROM artifacts a
      JOIN workflow_runs r ON r.id = a.workflow_run_id
      WHERE a.storage_key = name
      AND r.triggered_by_user_id = auth.uid()
    )
  );
