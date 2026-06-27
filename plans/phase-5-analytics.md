# Phase 5: Engagement Analytics Implementation Plan

## Context
Continuing the Social Pivot roadmap, Phase 5 Analytics requires tracking followers gained, likes per post, and 30-day trending. We will create tables to store this data and a dashboard to display it.

## Scope
1. Database Schema
   - `account_analytics` table for daily snapshots (followers, following, posts).
2. Service Layer
   - Create functions to insert daily snapshots.
   - Create functions to fetch 30-day trends.
3. UI Components
   - `AnalyticsDashboard.tsx` to display charts/metrics.
   - Integrate into `AccountDetail` or as a standalone page.

## Implementation Steps

### Step 1: Database Migration
Create `20260627000003_analytics_schema.sql`
- Table: `account_analytics` (id, account_id, date, followers_count, following_count, posts_count, engagement_rate, created_at).
- RLS policies.
- Update `database.types.ts`.

### Step 2: Service Layer
Update `src/lib/account-service.ts` or create `analytics-service.ts`.
- `recordAnalyticsSnapshot(accountId, data)`
- `getAnalyticsTrends(accountId, days=30)`

### Step 3: Worker Integration (Optional/Mock for now)
- Update worker to parse follower counts from UI tree and save to DB.

### Step 4: UI Dashboard
- Create charts using Recharts.
- Build `EngagementAnalytics` component.
