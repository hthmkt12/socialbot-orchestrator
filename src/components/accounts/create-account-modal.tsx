import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      username,
      encrypted_password: password,
      platform,
      daily_action_limit: dailyLimit,
    });
    setUsername('');
    setPassword('');
    setPlatform('instagram');
    setDailyLimit(100);
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
            disabled={isSubmitting || !username || !password}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
