const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import {",
  "import { NavLink } from 'react-router-dom';\nimport {"
);

fs.writeFileSync(file, content);
