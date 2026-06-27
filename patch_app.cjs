const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const importStmt = `const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));\nconst AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));`;
const routeStmt = `<Route path="/schedules" element={withPageFallback(<SchedulesPage />)} />\n        <Route path="/analytics" element={withPageFallback(<AnalyticsPage />)} />`;

if (!content.includes('AnalyticsPage')) {
  content = content.replace("const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));", importStmt);
  content = content.replace('<Route path="/schedules" element={withPageFallback(<SchedulesPage />)} />', routeStmt);
  fs.writeFileSync(file, content);
  console.log('App.tsx patched');
}
