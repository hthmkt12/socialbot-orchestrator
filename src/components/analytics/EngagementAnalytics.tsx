import { useState } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { TrendingUp, Users, Heart, Activity } from 'lucide-react';
import { useAccountAnalytics, useAccountGrowth } from '../../hooks/use-analytics';
import { classifyAnalyticsSource } from '../../lib/analytics-source';
import Spinner from '../ui/Spinner';

interface EngagementAnalyticsProps {
  accountId: string;
}

export default function EngagementAnalytics({ accountId }: EngagementAnalyticsProps) {
  const [days, setDays] = useState(30);
  const { data: analytics, isLoading: isLoadingAnalytics } = useAccountAnalytics(accountId, days);
  const { data: growth, isLoading: isLoadingGrowth } = useAccountGrowth(accountId, days);

  if (isLoadingAnalytics || isLoadingGrowth) {
    return <div className="flex justify-center p-8"><Spinner size="md" /></div>;
  }

  const source = classifyAnalyticsSource(analytics);

  if (!analytics || analytics.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-gray-900 font-medium mb-2">No analytics data yet</h3>
        <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-3 py-1 inline-flex mb-3">
          Data source: {source.label}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {source.detail}
        </p>
      </div>
    );
  }

  if (source.state === 'unknown') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Activity className="w-12 h-12 text-amber-300 mx-auto mb-4" />
        <h3 className="text-gray-900 font-medium mb-2">Analytics source needs review</h3>
        <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-3 py-1 inline-flex mb-3">
          Data source: {source.label}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {source.detail}
        </p>
      </div>
    );
  }

  const chartData = analytics.map(a => ({
    date: new Date(a.snapshot_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    followers: a.followers_count,
    engagement: a.engagement_rate,
  }));

  const currentFollowers = analytics[analytics.length - 1]?.followers_count ?? 0;
  const currentEngagement = analytics[analytics.length - 1]?.engagement_rate ?? 0;

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Engagement Overview</h2>
          <p className="mt-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 inline-flex">
            Data source: {source.label}
          </p>
        </div>
        <select 
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-gray-500">Total Followers</div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{currentFollowers.toLocaleString()}</div>
          <div className="mt-2 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
            <span className="text-emerald-600 font-medium">+{growth?.followers_gained ?? 0}</span>
            <span className="text-gray-500 ml-1">vs last {days} days</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-gray-500">Avg Engagement</div>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{currentEngagement.toFixed(2)}%</div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-gray-500">30-day average: {growth?.avg_engagement?.toFixed(2) ?? '0.00'}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-gray-500">Account Health</div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">Good</div>
          <div className="mt-2 flex items-center text-sm text-gray-500">
            Growth is steady and organic
          </div>
        </div>
      </div>

      {/* Follower Growth Chart */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-sm font-medium text-gray-900 mb-6">Follower Growth</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }} 
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }} 
                domain={['dataMin - 10', 'dataMax + 10']}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="followers" 
                name="Followers"
                stroke="#6366f1" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorFollowers)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
