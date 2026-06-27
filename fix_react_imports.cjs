const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace("import React from 'react';\n", "");
  fs.writeFileSync(file, content);
}

fix('src/components/social-dashboard/StatCard.tsx');
fix('src/components/social-dashboard/AccountHealthCard.tsx');
