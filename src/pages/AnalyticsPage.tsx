import React from 'react';
import Header from '../components/layout/Header';
import { useAccounts } from '../hooks/use-accounts';
import EngagementAnalytics from '../components/analytics/EngagementAnalytics';
import Spinner from '../components/ui/Spinner';

export default function AnalyticsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>('');

  React.useEffect(() => {
    if (accounts?.length && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  return (
    <>
      <Header
        title="Analytics"
        subtitle="Track engagement and account growth"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Account Selector */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Select Account</label>
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="ml-4 flex-1 max-w-xs text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.username} ({acc.platform})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Analytics Dashboard */}
          {selectedAccountId ? (
            <EngagementAnalytics accountId={selectedAccountId} />
          ) : (
            <div className="text-center py-12 text-gray-500">
              Select an account to view analytics
            </div>
          )}
        </div>
      </div>
    </>
  );
}
