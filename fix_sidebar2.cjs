const fs = require('fs');
let code = fs.readFileSync('F:/project-bolt-sb1-keyopwhy/project/src/components/layout/Sidebar.tsx', 'utf8');

code = code.replace(/import \{ NavLink \} from 'react-router-dom';\nimport \{ Activity, BarChart3, CreditCard, Home, PlaySquare, Settings, Smartphone, Users, FileText, BookOpen, Workflow, Wifi, WifiOff \} from 'lucide-react';/, `import { NavLink } from 'react-router-dom';\nimport { Activity, BarChart3, Home, PlaySquare, Users, FileText, BookOpen, Workflow, Wifi, WifiOff } from 'lucide-react';`);

fs.writeFileSync('F:/project-bolt-sb1-keyopwhy/project/src/components/layout/Sidebar.tsx', code);
