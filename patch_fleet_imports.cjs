const fs = require('fs');

const gridCard = 'src/components/fleet-health/DeviceGridCard.tsx';
let content = fs.readFileSync(gridCard, 'utf8');
content = content.replace(
  "import { formatDistanceToNow } from '../../lib/utils/date';",
  "import { formatDistanceToNow } from 'date-fns';"
);
content = content.replace("device.last_ping_at || ", "");
content = content.replace("device.serial", "device.device_id_override || device.id.slice(0,8)");
fs.writeFileSync(gridCard, content);

const page = 'src/pages/fleet-health-page.tsx';
let pContent = fs.readFileSync(page, 'utf8');
pContent = pContent.replace("import { Smartphone, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';", "import { Smartphone, ShieldCheck } from 'lucide-react';");
pContent = pContent.replace("device.last_ping_at || ", "");
fs.writeFileSync(page, pContent);
