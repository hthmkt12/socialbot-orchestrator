const fs = require('fs');
const file = 'src/lib/database.types.ts';
let content = fs.readFileSync(file, 'utf8');

const analyticsType = `
export type AccountAnalytics = {
  id: string;
  account_id: string;
  snapshot_date: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number | null;
  created_at: string;
};
`;

if (!content.includes('export type AccountAnalytics = {')) {
  content = content.replace(
    'export interface AccountActionHistory {',
    analyticsType + '\nexport interface AccountActionHistory {'
  );
  fs.writeFileSync(file, content);
}
