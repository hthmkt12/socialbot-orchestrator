const fs = require('fs');

const appFile = 'src/App.tsx';
let appContent = fs.readFileSync(appFile, 'utf8');
const appImport = `const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));\nconst PricingPage = lazy(() => import('./pages/PricingPage'));`;
const appRoute = `<Route path="/analytics" element={withPageFallback(<AnalyticsPage />)} />\n        <Route path="/pricing" element={withPageFallback(<PricingPage />)} />`;

if (!appContent.includes('PricingPage')) {
  appContent = appContent.replace("const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));", appImport);
  appContent = appContent.replace('<Route path="/analytics" element={withPageFallback(<AnalyticsPage />)} />', appRoute);
  fs.writeFileSync(appFile, appContent);
}

const sidebarFile = 'src/components/layout/Sidebar.tsx';
let sidebarContent = fs.readFileSync(sidebarFile, 'utf8');
const sidebarImport = `import { NavLink } from 'react-router-dom';
import {
  Smartphone,
  FolderOpen,
  Workflow,
  Play,
  Layers,
  ShieldCheck,
  ScrollText,
  Zap,
  Bot,
  Cable,
  UserCircle,
  BarChart3,
  HeartPulse,
  ActivitySquare,
  CalendarClock,
  PieChart,
  Wifi,
  WifiOff,
  CreditCard,
} from 'lucide-react';`;

const sidebarItem = `  { to: '/analytics', label: 'Analytics', icon: PieChart },\n  { to: '/pricing', label: 'Pricing & Plans', icon: CreditCard },`;

if (!sidebarContent.includes('Pricing')) {
  sidebarContent = sidebarContent.replace(/import \{ NavLink \} from 'react-router-dom';\nimport \{[\s\S]*?\} from 'lucide-react';/g, sidebarImport);
  sidebarContent = sidebarContent.replace("  { to: '/analytics', label: 'Analytics', icon: PieChart },", sidebarItem);
  fs.writeFileSync(sidebarFile, sidebarContent);
}

