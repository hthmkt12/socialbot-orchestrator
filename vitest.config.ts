import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Stub Deno-only type imports for Vitest compatibility
      'jsr:@supabase/functions-js/edge-runtime.d.ts': 'data:text/javascript,export {}',
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
