import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createLogArtifact, MAX_INLINE_ARTIFACT_BYTES } from './worker-run-store';

const CANARY = 'ARTIFACT_LITERAL_CANARY_987';

function createSupabaseMock() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'artifact-1' }, error: null });
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const upload = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ insert }));
  const storageFrom = vi.fn(() => ({ upload }));
  const supabase = { from, storage: { from: storageFrom } } as unknown as SupabaseClient;

  return { supabase, insert, upload };
}

describe('createLogArtifact sensitive-literal boundary', () => {
  it('scrubs a bare sensitive literal before inline metadata persistence', async () => {
    const { supabase, insert } = createSupabaseMock();

    await createLogArtifact(
      supabase,
      'run-1',
      'device-1',
      'step-1',
      `backend rejected ${CANARY}`,
      { source: 'direct-boundary', detail: CANARY },
      [CANARY]
    );

    const artifact = insert.mock.calls[0]?.[0] as { metadata_json: Record<string, unknown> };
    expect(JSON.stringify(artifact)).not.toContain(CANARY);
    expect(artifact.metadata_json.text).toBe('backend rejected [REDACTED]');
    expect(artifact.metadata_json.detail).toBe('[REDACTED]');
  });

  it('scrubs a bare sensitive literal before object-storage upload', async () => {
    const { supabase, insert, upload } = createSupabaseMock();
    const largeText = `${'x'.repeat(MAX_INLINE_ARTIFACT_BYTES)}${CANARY}`;

    await createLogArtifact(
      supabase,
      'run-2',
      'device-2',
      'step-2',
      largeText,
      { source: 'large-log' },
      [CANARY]
    );

    const uploadBuffer = upload.mock.calls[0]?.[1] as Buffer;
    const artifact = insert.mock.calls[0]?.[0] as { metadata_json: Record<string, unknown> };
    expect(uploadBuffer.toString('utf-8')).not.toContain(CANARY);
    expect(JSON.stringify(artifact)).not.toContain(CANARY);
    expect(artifact.metadata_json.storage_status).toBe('uploaded');
  });

  it('scrubs sensitive literals from upload failure metadata', async () => {
    const { supabase, insert, upload } = createSupabaseMock();
    upload.mockResolvedValueOnce({ error: { message: `upload failed for ${CANARY}` } });

    await createLogArtifact(
      supabase,
      'run-3',
      'device-3',
      'step-3',
      `${'x'.repeat(MAX_INLINE_ARTIFACT_BYTES)}safe`,
      {},
      [CANARY]
    );

    const artifact = insert.mock.calls[0]?.[0] as { metadata_json: Record<string, unknown> };
    expect(JSON.stringify(artifact)).not.toContain(CANARY);
    expect(artifact.metadata_json.storage_error).toBe('upload failed for [REDACTED]');
  });
});
