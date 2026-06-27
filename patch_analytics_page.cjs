const fs = require('fs');
const file = 'src/pages/AnalyticsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { useAccounts } from '../hooks/useAccounts';", "import { useAccounts } from '../hooks/use-accounts';");
content = content.replace("acc =>", "(acc: any) =>");

fs.writeFileSync(file, content);
