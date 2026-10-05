import { useCallback, useSyncExternalStore } from 'react';
import type { TargetType } from '../lib/database.types';

const STORAGE_KEY = 'socialbot:run-presets';

export interface RunPreset {
  id: string;
  name: string;
  macroId: string;
  targetType: TargetType;
  deviceIds: string[];
  groupId: string;
  accountId: string;
  inputValues: Record<string, string>;
  createdAt: string;
}

/* ── localStorage helpers with safe fallback ── */

let cachedSnapshot: RunPreset[] | null = null;
const listeners = new Set<() => void>();

function readPresets(): RunPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunPreset[]) : [];
  } catch {
    return [];
  }
}

function writePresets(presets: RunPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* quota exceeded — silent */
  }
  cachedSnapshot = presets;
  listeners.forEach((fn) => fn());
}

function getSnapshot(): RunPreset[] {
  if (!cachedSnapshot) cachedSnapshot = readPresets();
  return cachedSnapshot;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/* ── Hook ── */

export function useRunPresets() {
  const presets = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const savePreset = useCallback(
    (preset: Omit<RunPreset, 'id' | 'createdAt'>) => {
      const next: RunPreset = {
        ...preset,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      writePresets([next, ...getSnapshot()]);
      return next;
    },
    [],
  );

  const deletePreset = useCallback((id: string) => {
    writePresets(getSnapshot().filter((p) => p.id !== id));
  }, []);

  return { presets, savePreset, deletePreset } as const;
}
