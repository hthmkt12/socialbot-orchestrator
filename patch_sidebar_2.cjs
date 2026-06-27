const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const importStmt = `import {\n  Smartphone,\n  FolderOpen,\n  Workflow,\n  Play,\n  History,\n  Layers,\n  ShieldCheck,\n  ScrollText,\n  Zap,\n  Bot,\n  Cable,\n  UserCircle,\n  BarChart3,\n  HeartPulse,\n  ActivitySquare,\n  CalendarClock,\n  PieChart,\n  Wifi,\n  WifiOff,\n} from 'lucide-react';`;

const navItem = `  { to: '/system-monitor', label: 'System Monitor', icon: ActivitySquare },\n  { to: '/schedules', label: 'Schedules', icon: CalendarClock },\n  { to: '/analytics', label: 'Analytics', icon: PieChart },`;

if (!content.includes('Analytics')) {
  content = content.replace(/import \{[\s\S]*?\} from 'lucide-react';/g, importStmt);
  content = content.replace("  { to: '/system-monitor', label: 'System Monitor', icon: ActivitySquare },", navItem);
  fs.writeFileSync(file, content);
  console.log('Sidebar.tsx patched again');
}
