import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  HeartPulse,
  Home,
  PlaySquare,
  SlidersHorizontal,
  ShieldCheck,
  Smartphone,
  Terminal,
  Users,
  Workflow,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { useLaixiStore } from '../../stores/laixi';
import { useAuthStore } from '../../stores/auth';
import { canManageUsers, canViewAuditLogs, getRoleLabel } from '../../lib/role-access';

type NavItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  id: string;
  requiresAdminAccess?: boolean;
  requiresAuditAccess?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { icon: Home, label: 'Social Dashboard', path: '/social-dashboard', id: 'social-dashboard' },
      { icon: ClipboardList, label: 'Runs', path: '/runs', id: 'runs' },
      { icon: ShieldCheck, label: 'Approvals', path: '/approvals', id: 'approvals' },
      { icon: Smartphone, label: 'Devices', path: '/devices', id: 'devices' },
      { icon: FolderKanban, label: 'Device Groups', path: '/device-groups', id: 'device-groups' },
      { icon: Wrench, label: 'Device Setup', path: '/device-setup', id: 'device-setup' },
      { icon: Terminal, label: 'Mobile MCP', path: '/mobile-mcp-orchestrator', id: 'mobile-mcp-orchestrator' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { icon: PlaySquare, label: 'Macros', path: '/macros', id: 'macros' },
      { icon: CalendarClock, label: 'Schedules', path: '/schedules', id: 'schedules' },
      { icon: Users, label: 'Accounts', path: '/accounts', id: 'accounts' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: BarChart3, label: 'Analytics', path: '/analytics', id: 'analytics' },
      { icon: ShieldCheck, label: 'Readiness', path: '/readiness', id: 'readiness' },
      { icon: HeartPulse, label: 'Fleet Health', path: '/fleet-health', id: 'fleet-health' },
      { icon: Activity, label: 'System Monitor', path: '/system-monitor', id: 'system-monitor' },
      { icon: FileText, label: 'Audit Logs', path: '/audit-logs', id: 'audit-logs', requiresAuditAccess: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { icon: Users, label: 'User Roles', path: '/admin/users', id: 'admin-users', requiresAdminAccess: true },
      { icon: SlidersHorizontal, label: 'Execution Profiles', path: '/admin/execution-profiles', id: 'admin-execution-profiles', requiresAdminAccess: true },
    ],
  },
];

export default function Sidebar() {
  const connectionState = useLaixiStore((s) => s.connectionState);
  const profile = useAuthStore((s) => s.profile);
  const isConnected = connectionState === 'connected';
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (
        (!item.requiresAuditAccess || canViewAuditLogs(profile?.role)) &&
        (!item.requiresAdminAccess || canManageUsers(profile?.role))
      )),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">SOCIALBOT OPS</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Social Automation</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{section.label}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-800">
        <div className="px-3 py-2 mb-2 rounded-lg bg-gray-800/50">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Role</p>
          <p className="text-xs font-medium text-gray-200 mt-1">{getRoleLabel(profile?.role)}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
          <span className="text-xs text-gray-400">
            Bridge: <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>{connectionState}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
