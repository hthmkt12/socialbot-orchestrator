const fs = require('fs');
let code = fs.readFileSync('F:/project-bolt-sb1-keyopwhy/project/src/components/layout/Sidebar.tsx', 'utf8');

// Restore all imports properly
code = code.replace(/import \{ Activity, BarChart3, CreditCard, Home, PlaySquare, Settings, Smartphone, Users, FileText, BookOpen \} from 'lucide-react';/, `import { NavLink } from 'react-router-dom';\nimport { Activity, BarChart3, CreditCard, Home, PlaySquare, Settings, Smartphone, Users, FileText, BookOpen, Workflow, Wifi, WifiOff } from 'lucide-react';`);

// Fix navItems structure to match what is expected
code = code.replace(/const navItems = \[[\s\S]*?\];/, `const navItems = [
  { icon: Home, label: 'Social Dashboard', path: '/social', id: 'social-dashboard' },
  { icon: PlaySquare, label: 'Macros', path: '/macros', id: 'macros' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', id: 'analytics' },
  { icon: Users, label: 'Account Setup', path: '/accounts', id: 'accounts' },
  { icon: Activity, label: 'System Monitor', path: '/monitor', id: 'system-monitor' },
  { icon: FileText, label: 'Audit Logs', path: '/audit', id: 'audit-logs', requiresAuditAccess: true },
  { icon: BookOpen, label: 'Documentation', path: '/docs', id: 'docs' },
];`);

// Fix NavLink map parameters (to vs path)
code = code.replace(/key=\{item\.to\}/g, 'key={item.path}');
code = code.replace(/to=\{item\.to\}/g, 'to={item.path}');

fs.writeFileSync('F:/project-bolt-sb1-keyopwhy/project/src/components/layout/Sidebar.tsx', code);

let docCode = fs.readFileSync('F:/project-bolt-sb1-keyopwhy/project/src/pages/DocsPage.tsx', 'utf8');
docCode = docCode.replace(/import \{ Book, ChevronRight \} from 'lucide-react';/, `import { ChevronRight } from 'lucide-react';`);
fs.writeFileSync('F:/project-bolt-sb1-keyopwhy/project/src/pages/DocsPage.tsx', docCode);
