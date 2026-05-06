import { create } from 'zustand';
import type { LaixiConnectionState } from '../adapters/laixi/types';
import { getLaixiClient } from '../adapters/laixi/client';

interface LaixiState {
  connectionState: LaixiConnectionState;
  connect: () => void;
  disconnect: () => void;
}

let removeListener: (() => void) | null = null;

export const useLaixiStore = create<LaixiState>((set) => ({
  connectionState: 'disconnected',

  connect: () => {
    const client = getLaixiClient();
    // Remove any previously registered listener before adding a new one
    if (removeListener) {
      removeListener();
    }
    removeListener = client.onConnectionChange((state) => {
      set({ connectionState: state });
    });
    client.connect();
  },

  disconnect: () => {
    const client = getLaixiClient();
    client.disconnect();
    if (removeListener) {
      removeListener();
      removeListener = null;
    }
    set({ connectionState: 'disconnected' });
  },
}));
