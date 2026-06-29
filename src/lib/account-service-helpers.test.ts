import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import { supabase } from './supabase';
const mockFrom = vi.mocked(supabase.from) as any;
const mockGetSession = vi.mocked(supabase.auth.getSession) as any;

vi.mock('./audit', () => ({
  logAudit: vi.fn(),
}));

// Import after mocks are hoisted by vitest
import {
  fetchAccounts,
  fetchAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  fetchAccountHistory,
  recordAccountAction,
} from './account-service-helpers';

function createThenable<T>(resolvedValue: T, methods: object = {}) {
  return {
    ...methods,
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(resolvedValue).then(onfulfilled, onrejected);
    }
  };
}

function setupMockSelect(data: unknown = []) {
  const selectChain = vi.fn();
  const eqChain = vi.fn();
  const orderChain = vi.fn();
  const limitChain = vi.fn();
  const maybeSingleChain = vi.fn();

  const limitObj = createThenable({ data, error: null });
  const maybeSingleObj = createThenable({ data: Array.isArray(data) ? data[0] : data, error: null });

  const orderObj = createThenable(
    { data, error: null },
    { limit: limitChain, maybeSingle: maybeSingleChain }
  );
  const eqObj = createThenable(
    { data: Array.isArray(data) ? data[0] : data, error: null },
    { eq: eqChain, order: orderChain, maybeSingle: maybeSingleChain }
  );
  const selectObj = createThenable(
    { data, error: null },
    { eq: eqChain, order: orderChain, maybeSingle: maybeSingleChain }
  );

  selectChain.mockReturnValue(selectObj);
  eqChain.mockReturnValue(eqObj);
  orderChain.mockReturnValue(orderObj);
  limitChain.mockReturnValue(limitObj);
  maybeSingleChain.mockReturnValue(maybeSingleObj);

  return { selectChain, eqChain, orderChain, limitChain, maybeSingleChain };
}

describe('account-service-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  describe('fetchAccounts', () => {
    it('fetches all accounts ordered by creation date', async () => {
      const mockAccounts = [{ id: '1', username: 'test', platform: 'instagram' }];
      const { selectChain, orderChain } = setupMockSelect(mockAccounts);
      mockFrom.mockReturnValue({ select: selectChain, order: orderChain });

      const result = await fetchAccounts();

      expect(mockFrom).toHaveBeenCalledWith('accounts');
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('test');
    });

    it('throws on error', async () => {
      const { selectChain, orderChain } = setupMockSelect();
      const errorObj = createThenable({ data: null, error: { message: 'DB error' } });
      orderChain.mockReturnValue(errorObj);
      mockFrom.mockReturnValue({ select: selectChain, order: orderChain });

      await expect(fetchAccounts()).rejects.toThrow('DB error');
    });
  });

  describe('fetchAccount', () => {
    it('fetches a single account by id', async () => {
      const mockAccount = { id: '1', username: 'test_user', platform: 'instagram' };
      chainSelectEq({ maybeSingleData: mockAccount });
      mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle });

      const result = await fetchAccount('1');

      expect(mockFrom).toHaveBeenCalledWith('accounts');
      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result.username).toBe('test_user');
    });

    it('throws when account not found', async () => {
      chainSelectEq({ maybeSingleData: null });
      mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle });

      await expect(fetchAccount('nonexistent')).rejects.toThrow('Account not found');
    });

    it('throws when supabase error occurs', async () => {
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'Database query failed' } });
      mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle });

      await expect(fetchAccount('1')).rejects.toThrow('Failed to fetch account: Database query failed');
    });
  });

  describe('createAccount', () => {
    beforeEach(() => {
      mockGetSession.mockReset();
    });

    it('creates an account with defaults', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });

      const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
        }
        return { select: mockSelect, insert: mockInsert, maybeSingle: mockMaybeSingle };
      });

      const accountData = { id: 'new-1', username: 'new_user', platform: 'instagram' };
      const accountMaybeSingle = vi.fn().mockResolvedValue({ data: accountData, error: null });
      const accountSelect = vi.fn().mockReturnValue({ maybeSingle: accountMaybeSingle });
      mockInsert.mockReturnValue({ select: accountSelect });

      const result = await createAccount({
        username: 'new_user',
        encrypted_password: 'secret',
        platform: 'instagram',
      });

      expect(result.username).toBe('new_user');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        username: 'new_user',
        daily_action_limit: 100,
      }));
    });

    it('throws when profile lookup query fails', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });

      const profileMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Profile lookup failed' } });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
        }
        return {};
      });

      await expect(createAccount({
        username: 'fail',
        encrypted_password: 'pwd',
        platform: 'instagram',
      })).rejects.toThrow('Failed to get profile: Profile lookup failed');
    });

    it('throws when profile not found', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });

      const profileMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
        }
        return {};
      });

      await expect(createAccount({
        username: 'noprofile',
        encrypted_password: 'secret',
        platform: 'tiktok',
      })).rejects.toThrow('User profile not found');
    });

    it('uses provided daily_action_limit', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });

      const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
        }
        return { select: mockSelect, insert: mockInsert, maybeSingle: mockMaybeSingle };
      });

      const accountData = { id: 'new-2', username: 'limited', platform: 'facebook', daily_action_limit: 50 };
      const accountMaybeSingle = vi.fn().mockResolvedValue({ data: accountData, error: null });
      const accountSelect = vi.fn().mockReturnValue({ maybeSingle: accountMaybeSingle });
      mockInsert.mockReturnValue({ select: accountSelect });

      await createAccount({
        username: 'limited',
        encrypted_password: 'secret',
        platform: 'facebook',
        daily_action_limit: 50,
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ daily_action_limit: 50 }));
    });

    it('throws when account insert query fails', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });

      const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
        }
        return { select: mockSelect, insert: mockInsert, maybeSingle: mockMaybeSingle };
      });

      const accountMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      const accountSelect = vi.fn().mockReturnValue({ maybeSingle: accountMaybeSingle });
      mockInsert.mockReturnValue({ select: accountSelect });

      await expect(createAccount({
        username: 'fail',
        encrypted_password: 'pwd',
        platform: 'instagram',
      })).rejects.toThrow('Failed to create account: Insert failed');
    });

    it('throws when insert returns null data', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      });

      const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
        }
        return { select: mockSelect, insert: mockInsert, maybeSingle: mockMaybeSingle };
      });

      const accountMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const accountSelect = vi.fn().mockReturnValue({ maybeSingle: accountMaybeSingle });
      mockInsert.mockReturnValue({ select: accountSelect });

      await expect(createAccount({
        username: 'fail',
        encrypted_password: 'pwd',
        platform: 'instagram',
      })).rejects.toThrow('Account not created');
    });
  });

  describe('updateAccount', () => {
    it('updates account fields', async () => {
      setupUpdateChain({ id: '1', username: 'updated', daily_action_limit: 150 });

      const result = await updateAccount('1', { daily_action_limit: 150 });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ daily_action_limit: 150 }));
      expect(result.daily_action_limit).toBe(150);
    });

    it('throws when update query fails', async () => {
      const updateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });
      const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
      const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
      mockUpdate.mockReturnValue({ eq: updateEq });
      mockFrom.mockReturnValue({ update: mockUpdate });

      await expect(updateAccount('1', { daily_action_limit: 150 })).rejects.toThrow('Failed to update account: Update failed');
    });
  });

  describe('deleteAccount', () => {
    it('deletes account by id', async () => {
      const deleteEq = vi.fn().mockResolvedValue({ error: null });
      const deleteMaybeSingle = vi.fn().mockResolvedValue({ data: { username: 'deleted_user' }, error: null });
      const selectEqChain = vi.fn().mockReturnValue({ maybeSingle: deleteMaybeSingle });
      const deleteSelect = vi.fn().mockReturnValue({ eq: selectEqChain });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'accounts') {
          return {
            select: deleteSelect,
            delete: vi.fn().mockReturnValue({ eq: deleteEq }),
          };
        }
        return {};
      });

      await deleteAccount('1');
      expect(deleteEq).toHaveBeenCalledWith('id', '1');
      expect(deleteMaybeSingle).toHaveBeenCalled();
    });

    it('throws when delete query fails', async () => {
      const deleteEq = vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      const deleteMaybeSingle = vi.fn().mockResolvedValue({ data: { username: 'deleted_user' }, error: null });
      const selectEqChain = vi.fn().mockReturnValue({ maybeSingle: deleteMaybeSingle });
      const deleteSelect = vi.fn().mockReturnValue({ eq: selectEqChain });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'accounts') {
          return {
            select: deleteSelect,
            delete: vi.fn().mockReturnValue({ eq: deleteEq }),
          };
        }
        return {};
      });

      await expect(deleteAccount('1')).rejects.toThrow('Failed to delete account: Delete failed');
    });
  });

  describe('fetchAccountHistory', () => {
    it('fetches action history for an account', async () => {
      const limitFn = vi.fn().mockResolvedValue({ data: [{ id: 'h1', action_type: 'like' }], error: null });
      mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, order: mockOrder, limit: limitFn });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ limit: limitFn });

      const result = await fetchAccountHistory('acc-1');

      expect(mockFrom).toHaveBeenCalledWith('account_action_history');
      expect(mockEq).toHaveBeenCalledWith('account_id', 'acc-1');
      expect(result).toHaveLength(1);
    });

    it('throws when history query fails', async () => {
      const limitFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'History fetch failed' } });
      mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, order: mockOrder, limit: limitFn });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ order: mockOrder });
      mockOrder.mockReturnValue({ limit: limitFn });

      await expect(fetchAccountHistory('acc-1')).rejects.toThrow('Failed to fetch account history: History fetch failed');
    });
  });

  describe('recordAccountAction', () => {
    it('records action successfully and returns the record', async () => {
      const record = { id: 'h1', account_id: 'acc-1', action_type: 'like' as const, success: true };
      const recordMaybeSingle = vi.fn().mockResolvedValue({ data: record, error: null });
      const recordSelect = vi.fn().mockReturnValue({ maybeSingle: recordMaybeSingle });
      const recordInsert = vi.fn().mockReturnValue({ select: recordSelect });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'account_action_history') {
          return { insert: recordInsert };
        }
        return {};
      });

      const result = await recordAccountAction({
        account_id: 'acc-1',
        action_type: 'like',
        success: true,
      });

      expect(recordInsert).toHaveBeenCalledWith(expect.objectContaining({
        account_id: 'acc-1',
        action_type: 'like',
        success: true,
      }));
      expect(result).toEqual(record);
    });

    it('throws when database insert fails', async () => {
      const recordMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert constraint error' } });
      const recordSelect = vi.fn().mockReturnValue({ maybeSingle: recordMaybeSingle });
      const recordInsert = vi.fn().mockReturnValue({ select: recordSelect });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'account_action_history') {
          return { insert: recordInsert };
        }
        return {};
      });

      await expect(recordAccountAction({
        account_id: 'acc-1',
        action_type: 'like',
      })).rejects.toThrow('Failed to record action: Insert constraint error');
    });
  });
});

// Helper: chain select → eq → maybeSingle
function chainSelectEq({ maybeSingleData }: { maybeSingleData: unknown }) {
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockMaybeSingle.mockResolvedValue({ data: maybeSingleData, error: null });
}

// Helper: chain update → eq → select → maybeSingle
function setupUpdateChain(data: unknown) {
  const updateMaybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  mockUpdate.mockReturnValue({ eq: updateEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
  return { updateSelect, updateEq, updateMaybeSingle };
}
