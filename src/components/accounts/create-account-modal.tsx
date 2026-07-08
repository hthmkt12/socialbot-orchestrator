import { useMemo, useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import { computeDefaultBudgets, ACTION_TYPE_LABELS } from '../../lib/action-budget-types';
import { encryptPassword, getCredentialPolicyStatus } from '../../lib/account-password-crypto';
import type { AccountPlatform } from '../../lib/database.types';

interface CreateAccountModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    username: string;
    encrypted_password: string;
    platform: AccountPlatform;
    daily_action_limit: number;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateAccountModal({ open, onClose, onSubmit, isSubmitting }: CreateAccountModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [platform, setPlatform] = useState<AccountPlatform>('instagram');
  const [dailyLimit, setDailyLimit] = useState(100);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const budgetMap = useMemo(() => computeDefaultBudgets(dailyLimit), [dailyLimit]);
  const credentialPolicy = getCredentialPolicyStatus();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      if (!credentialPolicy.canSavePilotCredential) {
        setSubmitError(credentialPolicy.message);
        return;
      }
      const encrypted = await encryptPassword(password);
      await onSubmit({
        username,
        encrypted_password: encrypted,
        platform,
        daily_action_limit: dailyLimit,
      });
      setUsername('');
      setPassword('');
      setPlatform('instagram');
      setDailyLimit(100);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to encrypt account password.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            placeholder="e.g. @myaccount"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            placeholder="Account password"
          />
        </div>

        <div className={`rounded-lg border px-3 py-2 text-xs ${
          credentialPolicy.severity === 'blocking'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          {credentialPolicy.message}
        </div>

        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {submitError}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as AccountPlatform)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Daily Action Limit</label>
          <input
            type="number"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            min={1}
            max={1000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {/* Budget breakdown preview */}
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1.5">Action Budget Breakdown</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(budgetMap).map(([type, budget]) => (
              <span key={type} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                <span className="font-semibold">{ACTION_TYPE_LABELS[type as keyof typeof ACTION_TYPE_LABELS]}</span>
                {budget.daily}/d
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !username || !password || !credentialPolicy.canSavePilotCredential}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
