import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';

const mockGetSession = vi.mocked(supabase.auth.getSession) as Mock;
const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange) as Mock;
const mockSignInWithPassword = vi.mocked(supabase.auth.signInWithPassword) as Mock;
const mockSignUp = vi.mocked(supabase.auth.signUp) as Mock;

describe('auth store visitor handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    useAuthStore.setState({
      session: null,
      profile: null,
      loading: true,
      authError: null,
    });
  });

  it('VIS-ERR-004 fails closed when auth initialization cannot reach Supabase', async () => {
    mockGetSession
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ data: { session: null }, error: null });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      profile: null,
      loading: false,
      authError: 'Network unavailable',
    });

    await useAuthStore.getState().initialize();

    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState()).toMatchObject({
      session: null,
      profile: null,
      loading: false,
      authError: null,
    });
  });

  it('VIS-ERR-001 returns a clear login error and keeps the visitor unauthenticated', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });

    const result = await useAuthStore.getState().signIn('visitor@example.com', 'wrong-password');

    expect(result).toEqual({ error: 'Invalid login credentials' });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('VIS-ERR-003 returns a clear registration error without creating a session', async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: 'User already registered' } });

    const result = await useAuthStore.getState().signUp('visitor@example.com', 'password123');

    expect(result).toEqual({ error: 'User already registered' });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('VIS-ERR-004 returns a safe sign-in error when the auth request throws', async () => {
    mockSignInWithPassword.mockRejectedValueOnce(new Error('Failed to fetch'));

    const result = await useAuthStore.getState().signIn('visitor@example.com', 'password123');

    expect(result).toEqual({ error: 'Failed to fetch' });
    expect(useAuthStore.getState().session).toBeNull();
  });
});
