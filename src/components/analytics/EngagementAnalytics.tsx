import { useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { TrendingUp, Users, Heart, Activity, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { useAccountAnalytics, useAccountGrowth, useAccountActionMetrics } from '../../hooks/use-analytics';
import { classifyAnalyticsSource } from '../../lib/analytics-source';
import Spinner from '../ui/Spinner';

interface EngagementAnalyticsProps {
  accountId: string;
}

const badgeStyles: Record<string, string> = {
  real_persisted: 'text-emerald-700 bg-emerald-50',
  insufficient_data: 'text-amber-700 bg-amber-50 border border-amber-200',
  unknown: 'text-red-700 bg-red-50 border border-red-200',
};

function getBadgeStyle(state: string) {
  return badgeStyles[state] || 'text-gray-700 bg-gray-50 border border-gray-200';
}

export default function EngagementAnalytics({ accountId }: EngagementAnalyticsProps) {
  const [days, setDays] = useState(30);
  const { data: analytics, isLoading: isLoadingAnalytics } = useAccountAnalytics(accountId, days);
  const { data: growth, isLoading: isLoadingGrowth } = useAccountGrowth(accountId, days);
  const { data: actionMetrics, isLoading: isLoadingActions } = useAccountActionMetrics(accountId, days);

  if (isLoadingAnalytics || isLoadingGrowth || isLoadingActions) {
    return <div className="flex justify-center p-8"><Spinner size="md" /></div>;
  }

  const source = classifyAnalyticsSource(analytics);
  const hasSnapshots = analytics && analytics.length > 0;
  const hasActions = (actionMetrics?.totalActions ?? 0) > 0;

  if (!hasSnapshots && !hasActions) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-gray-900 font-medium mb-2">No analytics data yet</h3>
        <p className={`text-xs font-medium rounded-full px-3 py-1 inline-flex mb-3 ${getBadgeStyle(source.state)}`}>
          Data source: {source.label}
        </p>
        <p className="text-gray-500 text-sm mb-6">
          {source.detail}
        </p>
      </div>
    );
  }

  const chartData = (analytics || []).map(a => ({
    date: new Date(a.snapshot_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    followers: a.followers_count,
    engagement: a.engagement_rate,
  }));

  const currentFollowers = analytics && analytics.length > 0 ? analytics[analytics.length - 1]?.followers_count ?? 0 : 0;
  const currentEngagement = analytics && analytics.length > 0 ? analytics[analytics.length - 1]?.engagement_rate ?? 0 : 0;

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Engagement & Action Analytics</h2>
          <p className={`mt-1 text-xs font-medium rounded-full px-3 py-1 inline-flex ${getBadgeStyle(source.state)}`}>
            Data source: {hasActions ? 'Real action events' : source.label}
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <span className="text-gray-500 ml-1">vs last {days}d</span>
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
            <span className="text-gray-500">Avg: {growth?.avg_engagement?.toFixed(2) ?? '0.00'}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-gray-500">Actions Executed</div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{(actionMetrics?.totalActions ?? 0).toLocaleString()}</div>
          <div className="mt-2 flex items-center text-sm text-gray-500">
            Across {actionMetrics?.dailyRollup.length ?? 0} active days
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-gray-500">Action Success Rate</div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{actionMetrics?.successRate ?? 100}%</div>
          <div className="mt-2 flex items-center text-sm text-gray-500">
            {actionMetrics?.recentFailures.length ? `${actionMetrics.recentFailures.length} recent error(s)` : '100% clean runs'}
          </div>
        </div>
      </div>

      {/* Real-time Executed Actions Daily Rollup Chart */}
      {actionMetrics && actionMetrics.dailyRollup.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Executed Actions Daily Rollup</h3>
              <p className="text-xs text-gray-500 mt-1">Aggregated live from device account action events</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center text-indigo-600 font-medium">
                <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full mr-1.5" /> Successful Actions
              </span>
              <span className="flex items-center text-rose-500 font-medium">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full mr-1.5" /> Failed / Blocked
              </span>
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionMetrics.dailyRollup} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  minTickGap={20}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="successCount" name="Successful" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="failedCount" name="Failed" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Action Breakdown Chips */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 py-1 mr-2">Action Distribution:</span>
            {Object.entries(actionMetrics.actionsByType).map(([type, count]) => (
              <span key={type} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                <span className="capitalize">{type}</span>: <strong className="ml-1 text-gray-900">{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Failures List (if any) */}
      {actionMetrics && actionMetrics.recentFailures.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mr-2" />
            <h4 className="text-sm font-semibold text-amber-900">Recent Action Errors / Block Incidents</h4>
          </div>
          <div className="space-y-2 mt-2">
            {actionMetrics.recentFailures.map((failure, idx) => (
              <div key={idx} className="text-xs bg-white/70 p-2.5 rounded-lg border border-amber-100 flex justify-between items-center">
                <div>
                  <span className="font-semibold uppercase text-amber-800 mr-2">[{failure.actionType}]</span>
                  <span className="text-gray-700">{failure.errorMessage}</span>
                </div>
                <span className="text-gray-400 text-[10px] ml-4 shrink-0">
                  {new Date(failure.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follower Growth Chart (when snapshots exist) */}
      {chartData.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-6">Follower Growth (Snapshots)</h3>
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
      )}
    </div>
  );
}

