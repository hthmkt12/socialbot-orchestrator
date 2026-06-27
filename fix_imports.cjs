const fs = require('fs');

function fix(file, replaces) {
  let content = fs.readFileSync(file, 'utf8');
  replaces.forEach(r => content = content.replace(r[0], r[1]));
  fs.writeFileSync(file, content);
}

fix('src/components/analytics/EngagementAnalytics.tsx', [
  ["import React, { useState } from 'react';", "import { useState } from 'react';"],
  ["LineChart, Line, XAxis, YAxis", "XAxis, YAxis"],
  ["Activity, AlertCircle", "Activity"]
]);

fix('src/components/layout/Sidebar.tsx', [
  ["  Play,\n  History,\n  Layers,", "  Play,\n  Layers,"]
]);

