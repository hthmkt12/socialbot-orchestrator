import { useCallback, useEffect, useRef } from 'react';
import type { RunStatus } from '../lib/database.types';

const ALERT_STATUSES: RunStatus[] = ['FAILED', 'CANCELLED'];
const STORAGE_KEY = 'socialbot:browser-notif-permission';

/** Request browser notification permission once per session. */
export function useBrowserNotificationPermission() {
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    try {
      const asked = sessionStorage.getItem(STORAGE_KEY);
      if (asked) return;
      sessionStorage.setItem(STORAGE_KEY, '1');
      void Notification.requestPermission();
    } catch {
      /* private browsing — skip */
    }
  }, []);
}

/** Fire a browser notification. Falls back silently when unavailable. */
function notify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    /* silent */
  }
}

/**
 * Track run list and fire browser notifications when a run transitions
 * to FAILED or CANCELLED.
 */
export function useRunStatusNotifications(
  runs: Array<{ id: string; status: RunStatus }> | undefined,
) {
  const prevMap = useRef<Map<string, RunStatus>>(new Map());

  const checkTransitions = useCallback(
    (current: Array<{ id: string; status: RunStatus }>) => {
      const prev = prevMap.current;
      for (const run of current) {
        const prevStatus = prev.get(run.id);
        if (!prevStatus) continue; // new run, skip
        if (prevStatus === run.status) continue; // no change
        if (ALERT_STATUSES.includes(run.status)) {
          notify(
            `Run ${run.status.toLowerCase()}`,
            `Run ${run.id.slice(0, 8)} changed from ${prevStatus} to ${run.status}`,
          );
        }
      }
      // rebuild map
      const next = new Map<string, RunStatus>();
      for (const run of current) next.set(run.id, run.status);
      prevMap.current = next;
    },
    [],
  );

  useEffect(() => {
    if (!runs) return;
    checkTransitions(runs);
  }, [runs, checkTransitions]);
}

/**
 * Fire a browser notification when an account is blocked.
 * Call with the accounts array from useAccounts.
 */
export function useAccountBlockNotifications(
  accounts: Array<{ id: string; username?: string; is_blocked?: boolean }> | undefined,
) {
  const prevBlocked = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!accounts) return;
    const prev = prevBlocked.current;
    const next = new Set<string>();
    for (const acc of accounts) {
      if (acc.is_blocked) {
        next.add(acc.id);
        if (!prev.has(acc.id)) {
          notify(
            'Account blocked',
            `Account ${acc.username ?? acc.id.slice(0, 8)} was blocked`,
          );
        }
      }
    }
    prevBlocked.current = next;
  }, [accounts]);
}
