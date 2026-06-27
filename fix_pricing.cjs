const fs = require('fs');
let content = fs.readFileSync('src/pages/PricingPage.tsx', 'utf8');
content = content.replace("import React from 'react';\n", "");
fs.writeFileSync('src/pages/PricingPage.tsx', content);
