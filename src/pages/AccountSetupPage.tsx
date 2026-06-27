import { useState } from 'react';
import { Plus, Upload, Users } from 'lucide-react';
import Header from '../components/layout/Header';
import { AccountTable } from '../components/accounts/account-table';
import { CreateAccountModal } from '../components/accounts/create-account-modal';
import { CsvImportModal } from '../components/accounts/csv-import-modal';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '../hooks/use-accounts';
import { useUIStore } from '../stores/ui';
import type { AccountPlatform } from '../lib/database.types';
import type { CsvAccountRow } from '../lib/account-csv-import-parser';

export default function AccountSetupPage() {
  const { data: accounts, isLoading } = useAccounts();
  const [showCreate, setShowCreate] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const addToast = useUIStore((s) => s.addToast);

  const handleCreate = async (data: {
    username: string;
    encrypted_password: string;
    platform: AccountPlatform;
    daily_action_limit: number;
  }) => {
    try {
      await createAccount.mutateAsync(data);
      addToast('Account added', 'success');
      setShowCreate(false);
    } catch {
      addToast('Failed to add account', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount.mutateAsync(id);
      addToast('Account deleted', 'success');
    } catch {
      addToast('Failed to delete account', 'error');
    }
  };

  const handleStartWarmUp = async (id: string) => {
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
    let success = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await createAccount.mutateAsync({
          username: row.username,
          encrypted_password: row.password,
          platform: row.platform,
          daily_action_limit: row.daily_limit,
        });
        success++;
      } catch {
        failed++;
      }
    }
    addToast(`Imported ${success} account${success !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`, failed ? 'info' : 'success');
    setShowCsvImport(false);
  };

  return (
    <>
      <Header
        title="Account Setup"
        subtitle={`${accounts?.length ?? 0} accounts`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCsvImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !accounts?.length ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No accounts yet"
            description="Add social media accounts to start automating workflows across Instagram, TikTok, and Facebook."
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Account
              </button>
            }
          />
        ) : (
          <AccountTable
            accounts={accounts}
            onDelete={handleDelete}
            onStartWarmUp={handleStartWarmUp}
            isDeleting={deleteAccount.isPending}
          />
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
        isImporting={createAccount.isPending}
      />
    </>
  );
}
