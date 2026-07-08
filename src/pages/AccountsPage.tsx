import { useState } from 'react';
import { Plus, Upload, Users, Activity, Target, ShieldAlert } from 'lucide-react';
import Header from '../components/layout/Header';
import { AccountTable } from '../components/accounts/account-table';
import { CreateAccountModal } from '../components/accounts/create-account-modal';
import { CsvImportModal } from '../components/accounts/csv-import-modal';
import EmptyState from '../components/ui/EmptyState';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import { useAccounts, useCreateAccount, useBatchCreateAccounts, useDeleteAccount, useUpdateAccount } from '../hooks/use-accounts';
import { encryptPassword, getCredentialPolicyStatus } from '../lib/account-password-crypto';
import { canManageAccounts, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import type { AccountPlatform } from '../lib/database.types';
import type { CsvAccountRow } from '../lib/account-csv-import-parser';

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const profile = useAuthStore((s) => s.profile);
  const [showCreate, setShowCreate] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const createAccount = useCreateAccount();
  const batchCreate = useBatchCreateAccounts();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const addToast = useUIStore((s) => s.addToast);
  const canEditAccounts = canManageAccounts(profile?.role);
  const credentialPolicy = getCredentialPolicyStatus();

  const handleCreate = async (data: {
    username: string;
    encrypted_password: string;
    platform: AccountPlatform;
    daily_action_limit: number;
  }) => {
    if (!canEditAccounts) {
      addToast('Only operators and admins can add social accounts', 'error');
      return;
    }
    try {
      await createAccount.mutateAsync(data);
      addToast('Account added', 'success');
      setShowCreate(false);
    } catch {
      addToast('Failed to add account', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEditAccounts) {
      addToast('Only operators and admins can delete social accounts', 'error');
      return;
    }
    try {
      await deleteAccount.mutateAsync(id);
      addToast('Account deleted', 'success');
    } catch {
      addToast('Failed to delete account', 'error');
    }
  };

  const handleStartWarmUp = async (id: string) => {
    if (!canEditAccounts) {
      addToast('Only operators and admins can change account warm-up state', 'error');
      return;
    }
    try {
      await updateAccount.mutateAsync({
        id,
        warm_up_stage: 2,
        warm_up_started_at: new Date().toISOString(),
      });
      addToast('Warm-up started', 'success');
    } catch {
      addToast('Failed to start warm-up', 'error');
    }
  };

  const handleCsvImport = async (rows: CsvAccountRow[]) => {
    if (!canEditAccounts) {
      addToast('Only operators and admins can import social accounts', 'error');
      return;
    }
    if (!credentialPolicy.canSavePilotCredential) {
      addToast(credentialPolicy.message, 'error');
      return;
    }
    try {
      const encryptedRows = await Promise.all(
        rows.map(async (row) => ({
          username: row.username,
          encrypted_password: await encryptPassword(row.password),
          platform: row.platform,
          daily_action_limit: row.daily_limit,
        }))
      );
      const { success, failed } = await batchCreate.mutateAsync(encryptedRows);
      addToast(`Imported ${success} accounts${failed ? `, ${failed} failed` : ''}`, failed ? 'info' : 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to import accounts', 'error');
    }
    setShowCsvImport(false);
  };

  const activeAccounts = accounts?.filter(a => !a.is_blocked).length ?? 0;
  const blockedAccounts = accounts?.filter(a => a.is_blocked).length ?? 0;
  const warmingUp = accounts?.filter(a => a.warm_up_stage < 5 && !a.is_blocked).length ?? 0;

  return (
    <>
      <Header
        title="Social Accounts"
        subtitle={`${accounts?.length ?? 0} total accounts`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!canEditAccounts) {
                  addToast('Only operators and admins can import social accounts', 'error');
                  return;
                }
                setShowCsvImport(true);
              }}
              disabled={!canEditAccounts}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => {
                if (!canEditAccounts) {
                  addToast('Only operators and admins can add social accounts', 'error');
                  return;
                }
                setShowCreate(true);
              }}
              disabled={!canEditAccounts}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {!canEditAccounts && (
          <RoleAccessNotice
            title={`${getRoleLabel(profile?.role)} role can inspect accounts but not change them`}
            detail="You can view account status, warm-up stage, block flags, limits, and history. Only operators and admins can add, import, delete, or advance accounts."
          />
        )}

        {canEditAccounts && (
          <RoleAccessNotice
            title="Pilot-only credential boundary"
            detail={credentialPolicy.message}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
                        <Users className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Accounts</p>
                        <p className="text-2xl font-bold text-gray-900">{accounts?.length ?? 0}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Active</p>
                        <p className="text-2xl font-bold text-gray-900">{activeAccounts}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Target className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Warming Up</p>
                        <p className="text-2xl font-bold text-gray-900">{warmingUp}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Blocked</p>
                        <p className="text-2xl font-bold text-gray-900">{blockedAccounts}</p>
                    </div>
                </div>
            </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !accounts?.length ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No accounts yet"
            description="Add social media accounts to start automating workflows across platforms."
            action={
              <button
                onClick={() => {
                  if (!canEditAccounts) {
                    addToast('Only operators and admins can add social accounts', 'error');
                    return;
                  }
                  setShowCreate(true);
                }}
                disabled={!canEditAccounts}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Account
              </button>
            }
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <AccountTable
                accounts={accounts}
                onDelete={handleDelete}
                onStartWarmUp={handleStartWarmUp}
                isDeleting={deleteAccount.isPending}
                canManageAccounts={canEditAccounts}
            />
          </div>
        )}
      </div>

      <CreateAccountModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isSubmitting={createAccount.isPending}
      />

      <CsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onImport={handleCsvImport}
        isImporting={batchCreate.isPending}
        credentialPolicy={credentialPolicy}
      />
    </>
  );
}
