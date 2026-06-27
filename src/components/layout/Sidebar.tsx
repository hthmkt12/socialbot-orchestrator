import { NavLink } from 'react-router-dom';
import {
  Smartphone,
  FolderOpen,
  Workflow,
  Play,
  ShieldCheck,
  ScrollText,
  Layers,
  Wifi,
  WifiOff,
  Zap,
  Cable,
  Bot,
  UserCircle,
} from 'lucide-react';
import { useLaixiStore } from '../../stores/laixi';
import { useAuthStore } from '../../stores/auth';
import { canViewAuditLogs, getRoleLabel } from '../../lib/role-access';

const navItems = [
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/device-groups', label: 'Device Groups', icon: Layers },
  { to: '/device-setup', label: 'Device Setup', icon: Cable },
  { to: '/mobile-mcp-orchestrator', label: 'MCP Orchestrator', icon: Bot },
  { to: '/account-setup', label: 'Accounts', icon: UserCircle },
  { to: '/macros', label: 'Macros', icon: FolderOpen },
  { to: '/runs', label: 'Runs', icon: Play },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, requiresAuditAccess: true },
  { to: '/demo', label: 'E2E Demo', icon: Zap },
];

export default function Sidebar() {
  const connectionState = useLaixiStore((s) => s.connectionState);
  const profile = useAuthStore((s) => s.profile);
  const isConnected = connectionState === 'connected';
  const visibleNavItems = navItems.filter((item) => !item.requiresAuditAccess || canViewAuditLogs(profile?.role));

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">LAIXI PLATFORM</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Orchestration</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
            Laixi: <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>{connectionState}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
