import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Artifact } from '../lib/database.types';

export function useArtifactUrl(artifact: Artifact & { storage_path?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUrl() {
      if (!artifact.storage_path) {
        setUrl(null);
        return;
      }

      setIsLoading(true);
      try {
        // Artifacts bucket is private, need a signed URL. 
        // 60 seconds is enough for the preview card rendering.
        const { data, error } = await supabase.storage
          .from('artifacts')
          .createSignedUrl(artifact.storage_path, 60);

        if (error) {
          throw error;
        }

        if (isMounted && data?.signedUrl) {
          setUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to load artifact signed URL', err);
        if (isMounted) setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadUrl();

    return () => {
      isMounted = false;
    };
  }, [artifact.storage_path]);

  return { url, isLoading, error };
}
