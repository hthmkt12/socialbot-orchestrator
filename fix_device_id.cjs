const fs = require('fs');

const gridCard = 'src/components/fleet-health/DeviceGridCard.tsx';
let content = fs.readFileSync(gridCard, 'utf8');
content = content.replace("device.device_id_override", "(device as any).device_id_override");
fs.writeFileSync(gridCard, content);
