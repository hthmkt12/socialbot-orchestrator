import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useUIStore } from '../../stores/ui';
import { useRuns } from '../../hooks/useRuns';
import { useAccounts } from '../../hooks/use-accounts';
import {
  useBrowserNotificationPermission,
  useRunStatusNotifications,
  useAccountBlockNotifications,
} from '../../hooks/use-browser-notifications';
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts';

export default function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  /* Browser notification wiring — request permission once, then track status changes */
  useBrowserNotificationPermission();
  const { data: runs } = useRuns();
  const { data: accounts } = useAccounts();
  useRunStatusNotifications(runs);
  useAccountBlockNotifications(accounts);
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block`}>
        <Sidebar />
      </div>
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
