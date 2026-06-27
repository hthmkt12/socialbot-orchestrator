const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

const importStmt = `import { \n  Smartphone, FolderTree, PlayCircle, History, FileText, \n  Settings, Users, Shield, Clock, PlusSquare, Network, BarChart2,\n  CalendarClock, Activity, PieChart\n} from 'lucide-react';`;

const navItem = `  { name: 'Schedules', href: '/schedules', icon: CalendarClock },\n  { name: 'Analytics', href: '/analytics', icon: PieChart },`;

if (!content.includes('Analytics')) {
  content = content.replace(/import \{.*?\} from 'lucide-react';/s, importStmt);
  content = content.replace("  { name: 'Schedules', href: '/schedules', icon: CalendarClock },", navItem);
  fs.writeFileSync(file, content);
  console.log('Sidebar.tsx patched');
}
