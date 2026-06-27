# Phase 6: Object Storage Implementation Plan

## Context
Per `specs/003-artifact-storage-thresholds/spec.md`, we are currently storing artifacts (screenshots, logs, JSON) inline in the `run_artifacts` database rows as base64 or raw text. This is limited to 512KB and < 5 screenshots per run.

As we scale to Social Media Automation, runs will produce many screenshots (e.g., proof of likes/follows) and large DOM tree dumps. We must migrate to **Supabase Storage**.

## Scope
1. **Supabase Storage Bucket**
   - Create a `run_artifacts` public or authenticated bucket.
2. **Database Schema Update**
   - Modify `run_artifacts` table to support `storage_path` (string) and deprecate/migrate `content` (text).
   - Ensure backward compatibility: if `content` exists, use it; if `storage_path` exists, fetch a signed URL or public URL.
3. **Worker Backend Update**
   - In `services/execution-worker/src/runner-device-step.ts` (or equivalent), modify artifact creation to upload to Supabase Storage and save the path to the DB.
4. **UI Updates**
   - Update `RunStepArtifact.tsx` (or equivalent) to render images/logs from the `storage_path` URL instead of inline base64 data.

## Implementation Steps

### Step 1: Database Migration
- Create `supabase/migrations/20260627000004_object_storage.sql`
- Add `storage_path` text column to `run_artifacts`.
- Create the storage bucket `run_artifacts` via SQL.
- Set up RLS policies on the `storage.objects` table allowing authenticated users to read/write their own artifacts (joined via `run_artifacts` -> `workflow_runs`).

### Step 2: Update database.types.ts
- Add `storage_path?: string | null` to `RunArtifact` types.

### Step 3: Worker Upload Logic
- The execution worker has a Supabase service role key.
- Update artifact capture logic:
  - If content > threshold or if it's a screenshot, upload to `run_artifacts` bucket.
  - Path format: `{run_id}/{device_id}/{step_id}_{timestamp}.png`
  - Store `storage_path` in DB.

### Step 4: UI Artifact Rendering
- Create a hook `useArtifactUrl(artifact)` that:
  - Returns `data:image/png;base64,...` if `content` is present.
  - Returns a Supabase storage signed URL or public URL if `storage_path` is present.
- Update the artifact viewer UI.

## Risk Assessment
- **Migration of existing data**: Existing inline artifacts will keep working since we preserve the `content` column.
- **RLS Complexity**: Storage RLS can be tricky when it needs to join against Postgres tables. We may need to use `auth.uid()` mapped against a path structure or use the service role key to generate signed URLs from the backend.
