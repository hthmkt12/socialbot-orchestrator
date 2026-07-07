import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/database.types';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as Profile | null;
}

let authListenerRegistered = false;
let initializePromise: Promise<void> | null = null;

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  loading: true,
  authError: null,

  setSession: (session) => set({ session, authError: null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    // Deduplicate: reuse in-flight or completed init
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      set({ loading: true });
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        set({ session, authError: null });

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          set({ profile });
        } else {
          set({ profile: null });
        }
      } catch (error) {
        set({
          session: null,
          profile: null,
          authError: getAuthErrorMessage(error, 'Unable to connect to authentication. Please try again.'),
        });
        initializePromise = null;
      } finally {
        set({ loading: false });
      }

      if (!authListenerRegistered) {
        authListenerRegistered = true;
        supabase.auth.onAuthStateChange((_event, newSession) => {
          set({ session: newSession, authError: null });
          if (newSession?.user) {
            (async () => {
              try {
                const profile = await fetchProfile(newSession.user.id);
                set({ profile });
              } catch {
                set({ profile: null });
              }
            })();
          } else {
            set({ profile: null });
          }
        });
      }
    })();

    return initializePromise;
  },

  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      set({ authError: null });
      return {};
    } catch (error) {
      return { error: getAuthErrorMessage(error, 'Unable to sign in. Please check your connection and try again.') };
    }
  },

  signUp: async (email, password) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      set({ authError: null });
      return {};
    } catch (error) {
      return { error: getAuthErrorMessage(error, 'Unable to create account. Please check your connection and try again.') };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, authError: null });
  },
}));
