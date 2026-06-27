# Brainstorm Report: Social-First Platform Reorientation

**Date:** 2026-06-26  
**Status:** Approved for Planning  
**Strategic Direction:** Pivot from generic device orchestration → **Social Media Automation Platform**

---

## Executive Summary

Your actual users are **social media automation teams (5-50 devices)** running simple workflows (2-5 steps: tap, scroll, post, screenshot). They need:

- **Anti-detection capabilities** (randomized delays, device fingerprinting, human-like patterns)
- **Account lifecycle tracking** (warm-up status, action counts, safety limits)
- **Multi-app workflows** (Instagram, TikTok, Facebook automation)
- **Reliable multi-device execution** (sequential is fine; failover on block is critical)

**Current platform gap:** Treats automation as generic device orchestration + audit trail. Missing anti-detection, account state management, and social-specific workflows.

**Recommendation:** Reposition as **"Social Media Automation Orchestrator"** — keep device backend, refocus features/roadmap on social use case.

---

## Problem Statement

### User Profile
- **Type:** Social media automation teams (marketers, growth hackers, agency ops)
- **Scale:** 5-50 Android devices per team
- **Primary Pain:** Manual account management on many devices is slow; platform should automate at scale

### Core Use Cases
1. **Content Engagement Automation** — Like, comment, follow on Instagram, TikTok, Facebook
2. **Multi-Account Publishing** — Post content across 10-20 accounts simultaneously
3. **Long-Running Account Automation** — Warm-up sequences, gradual action ramp, account conditioning
4. **Device Rotation on Block** — If one device/account is flagged, automatically failover to another

### Non-Negotiable Features
1. **Human-Like Behavior** — Random delays, action variance, scrolling patterns (avoid bot detection)
2. **Account State Tracking** — Know which accounts are in warm-up, how many actions today, safety limits
3. **Multi-App Support** — Same workflow framework for Instagram, TikTok, Facebook
4. **Failover Handling** — Auto-rotate devices when accounts get blocked

---

## Current State vs. Target State

### Current Architecture
- Generic device orchestration + macro versioning + audit trail
- Mobile MCP backend (device execution proven)
- Sequential multi-device execution ✓ (adequate for 5-50 device scale)
- No anti-detection, no account state, no social templates

### What Stays (Low Cost)
- React + Zustand + React Query frontend
- Supabase auth + RLS
- Mobile MCP backend execution
- Macro versioning & audit trail
- Device inventory & health monitoring

### What Changes (Medium Cost)
- **Add** account lifecycle schema (accounts table, action history tracking)
- **Add** anti-detection engine (randomization helpers, delay variance)
- **Add** social macro library (pre-built Instagram, TikTok, Facebook templates)
- **Rename** macros → workflows (social-specific language)
- **Deprecate** Laixi integration (defer until social customers request it)

### What's Removed (Enables Focus)
- QA test reporting features (parallel execution, test coverage, CI integration)
- Complex 15+ step logic (social workflows are 2-5 steps)
- Laixi gateway proof (blocked externally; mobile MCP is sufficient)

---

## Evaluated Approaches

### Approach 1: **Pivot to Social-First** ✅ CHOSEN
**Definition:** Reposition platform as **"Social Media Automation Orchestrator"**. Reorder all roadmap priorities toward social use case. QA/testing is future expansion only.

**Pros:**
- Clear market positioning (avoid competing with generic test platforms)
- Faster to revenue (social teams care less about parallel execution, more about anti-detection)
- Natural upsell to account health, analytics, risk management
- Differentiation through anti-bot expertise
- Simpler workflows (2-5 steps) = simpler UI/UX

**Cons:**
- Narrows immediate market (lose QA/testing customers)
- Requires social platform deep-dive (API changes, policy compliance)
- Higher abuse/risk management burden (platform policies, account bans, legal)
- Social automation is higher-legal-risk product category

**Recommendation:** Start with Instagram + TikTok (highest adoption). Facebook later. Monitor policy risk closely.

---

### Approach 2: Generic + Social Module (Not Chosen)
Keep current roadmap, add social features as module. Rejected because:
- Blurry positioning confuses customers (are we QA or social?)
- Competing priorities split engineering effort
- Makes codebase harder to maintain (two distinct feature paths)

---

### Approach 3: Hybrid (Mentioned but Not Chosen)
Social-optimized generic platform. Rejected because:
- Added complexity doesn't match user needs (social users don't need QA features)
- Higher technical debt than pure-social approach
- Harder to market

---

## Recommended Roadmap (Phase-Based)

### Phase 0: Foundation (June 2026) — Reposition & Stabilize
**Goals:**
- Rename platform from "Laixi Orchestration" → "SocialBot Orchestrator" or "Account Automation Platform"
- Update docs/messaging to reflect social positioning
- Verify Mobile MCP backend is stable (Device Setup tests passing)
- Set up account schema (prepare for Phase 1)

**Deliverables:**
- Updated README, landing page, onboarding copy
- `accounts` table + `account_action_history` tracking table
- Updated `docs/project-overview-pdr.md` and roadmap
- Proof: Mobile MCP runs stable for 5 consecutive devices on simple workflow

**Timeline:** 2 weeks

---

### Phase 1: Anti-Detection & Account Lifecycle (Q3 2026) — MVP
**Goals:**
- Random delays + device fingerprinting working
- Account state tracking (action counts, warm-up status)
- Simple form to input accounts + target actions

**Deliverables:**
1. **Anti-Detection Engine**
   - `src/engine/anti-detection.ts` — randomization helpers
   - Random delays: 3-8 sec instead of fixed 5 sec
   - Device fingerprinting: fake user-agent, browser profile
   - Scroll variance: random scroll before taps
   - Applied to all macro steps transparently

2. **Account Lifecycle Tracking**
   - `accounts` table: `username, password, platform (instagram|tiktok|facebook), warm_up_started_at, daily_action_limit, current_action_count`
   - `account_action_history` table: timestamp, action_type (like, comment, follow, post), step_id, success/blocked
   - Query hooks in `src/hooks/useAccounts.ts`
   - Account detail page showing warm-up status, action counts, history

3. **Simple Account Input UI**
   - New page `/account-setup` with form: username, password, target platform, action limits
   - CSV import for bulk 100+ accounts (Phase 2 if time)
   - Store in Supabase with RLS per user/team

4. **Proof**
   - Run 5 devices x 10 Instagram follow-actions each. Screenshot before/after action counts.
   - Anti-detection working: delays vary per run (not fixed 5 sec)
   - Accounts tracked: daily counts reset at 24h boundary

**Timeline:** 6 weeks  
**Success Metrics:**
- 5-device run completes with no bot detection
- Account action counts accurate
- Delays verifiable from step logs (3-8s range)

---

### Phase 2: Social Macro Templates + Multi-App (Q4 2026)
**Goals:**
- Pre-built workflows for Instagram (like, follow, comment on hashtag)
- Pre-built workflows for TikTok (like, follow, comment)
- Accounts can target multiple apps in one run

**Deliverables:**
1. **Social Macro Library**
   - `/src/contracts/social-templates/` with:
     - `instagram-like-hashtag.json` — search hashtag, like N posts, human-like delays
     - `instagram-follow-accounts.json` — follow M accounts with warm-up checks
     - `tiktok-like-trending.json` — scroll FYP, like trending videos
     - `facebook-like-pages.json` — like posts on N Facebook pages
   - Each includes: anti-detection config (delay range, scroll variance), safety limits

2. **Multi-App Macro Support**
   - Macro step can target `["instagram", "tiktok"]` in parallel (but sequential per device)
   - Step routing: detect app in focus, adapt commands accordingly
   - Macro version tracks supported apps

3. **Account-to-Macro Mapping**
   - Run wizard: select accounts, select template, configure targets (which hashtags, how many likes, etc.)
   - Validation: warn if Instagram account not yet warm-up 48h
   - Execute: all accounts run same template with per-app adaptations

**Timeline:** 8 weeks  
**Success Metrics:**
- Run 20 accounts across Instagram + TikTok with like-hashtag template
- No bot detection flags
- Account action counts segregated per app

---

### Phase 3: Safety Limits & Warm-Up Sequences (Q1 2027)
**Goals:**
- Enforce max posts/day, max likes/hour, required cooldowns
- Automated warm-up sequences (gradual action increase over 7-14 days)
- Dashboard showing account health (engagement rate, risk)

**Deliverables:**
1. **Safety Limit Engine**
   - Config per account: max_likes_per_day, max_follows_per_hour, cooldown_minutes_between_actions
   - Runtime check before each step: "This account already did 50 likes today; cool down 8 hours"
   - Macro execution pauses/retries or skips step based on policy

2. **Warm-Up Sequencer**
   - Pre-built warm-up macros: days 1-3 (low activity), days 4-7 (ramp), days 8+ (full speed)
   - Automated recommendation: "Account created 2 days ago; run warm-up phase 1 today"
   - Tracks warm-up stage, prevents early ramp-up

3. **Account Health Dashboard**
   - Followers gained/lost per week
   - Engagement rate trending
   - Risk score (age, action velocity, detection flags)
   - Recommend: rest/cool-down, revert to warm-up, or promote to full automation

**Timeline:** 6 weeks  
**Success Metrics:**
- 50 accounts running warm-up sequence; none flagged by Instagram/TikTok
- Safety limits enforced; accounts respect daily/hourly limits
- Dashboard shows realistic engagement curves

---

### Phase 4: Failover & Device Rotation (Q2 2027)
**Goals:**
- Auto-rotate to another device if current account is blocked
- Fleet health dashboard showing online/blocked/warm-up devices
- Retry logic with exponential backoff

**Deliverables:**
1. **Account Block Detection**
   - Macro includes "check-if-blocked" step (try to like a known post; detect "action unavailable")
   - On detection: mark account blocked, flag device for rotation

2. **Failover Logic**
   - Run queue: if account blocked on device A, pick device B (not blocked with this account)
   - If all devices blocked with account, pause and alert operator
   - Retry config: retry on device C after 24h cooldown

3. **Fleet Dashboard**
   - Account health per device (online, blocked, warm-up, ready)
   - Device utilization (which account running, how long, remaining quota)
   - Recommended actions (rotate to device B, warm-up account C, rest device A)

**Timeline:** 6 weeks  
**Success Metrics:**
- 20-device fleet runs 30 accounts; 5 accounts get blocked; failover succeeds 95% of time
- No manual intervention needed

---

### Phase 5: Scheduling & Analytics (Q3 2027)
**Goals:**
- Run macros on schedule (e.g., 9am daily, Monday-Friday)
- Engagement analytics: followers gained, likes per post, engagement rate
- Revenue feature: tier-based pricing on analytics export + scheduling

**Deliverables:**
1. **Scheduling Engine**
   - Cron-like UI: daily 9am, weekdays only, etc.
   - Queue integration: scheduled run auto-creates workflow_run at trigger time
   - Timezone support per account

2. **Analytics Aggregation**
   - Daily snapshot: followers_count, engagement_rate, new_followers_today
   - Historical trending: chart followers over 30 days
   - Export: CSV for customer reporting

3. **Revenue Model**
   - Free tier: up to 10 accounts, no analytics, manual runs only
   - Pro tier: up to 100 accounts, scheduling, engagement analytics
   - Enterprise: custom limits, API access, white-label option

**Timeline:** 8 weeks  
**Success Metrics:**
- 100 accounts on Pro tier scheduled to run 5x/week
- Analytics dashboard shows 30-day trending with >80% accuracy
- Revenue >$5k/month from Pro subscriptions

---

## Architecture Changes Required

### Database Schema Additions
```sql
-- Account lifecycle tracking
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  username text NOT NULL,
  encrypted_password text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook')),
  warm_up_started_at timestamp,
  warm_up_stage int DEFAULT 1,
  daily_action_limit int DEFAULT 100,
  current_action_count int DEFAULT 0,
  last_action_reset_at timestamp,
  is_blocked boolean DEFAULT false,
  detected_block_reason text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Action history for rate limiting + analytics
CREATE TABLE account_action_history (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES accounts(id),
  action_type text CHECK (action_type IN ('like', 'follow', 'comment', 'post', 'share')),
  step_id uuid REFERENCES run_steps(id),
  success boolean,
  error_message text,
  created_at timestamp DEFAULT now()
);

-- Scheduling
CREATE TABLE scheduled_runs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  macro_id uuid REFERENCES macros(id),
  account_ids uuid[] REFERENCES accounts(id),
  cron_schedule text,
  timezone text,
  enabled boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
```

### Code Structure Changes
```
src/
  ├── engine/
  │   ├── anti-detection.ts          # NEW: randomization, fingerprinting
  │   ├── safety-limits.ts            # NEW: rate limiting, warm-up enforcement
  │   ├── account-failover.ts         # NEW: block detection, rotation logic
  │   └── ...
  ├── lib/
  │   ├── account-service.ts          # NEW: account lifecycle queries
  │   ├── schedule-service.ts         # NEW: cron execution
  │   └── ...
  ├── hooks/
  │   ├── useAccounts.ts              # NEW: account CRUD
  │   └── ...
  ├── pages/
  │   ├── AccountSetup.tsx            # NEW: account management UI
  │   ├── AccountHealth.tsx           # NEW: dashboard
  │   └── ...
  └── contracts/
      └── social-templates/           # NEW: pre-built macros
          ├── instagram-*.json
          ├── tiktok-*.json
          └── facebook-*.json

services/
  └── execution-worker/
      └── src/
          ├── anti-detection.ts       # DUP: randomization engine
          ├── failover.ts             # NEW: block rotation
          └── ...
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Social platform policy changes (Instagram bans bot traffic) | High | Monitor platform policies weekly; build compliance layer; warn users of risk |
| Account bans escalating (aggressive automation gets mass-flagged) | High | Conservative warm-up defaults; aggressive safety limits; rate-limit documentation |
| Legal/liability (customers use for spam/harassment) | Medium | Terms of Service stating "for legitimate marketing only"; abuse monitoring; quick ban of violators |
| Competitors copy social macros | Low | Macros are templates, not IP; differentiation is reliability + support |
| Laixi integration neglect | Low | Document as "future expansion"; redirect Laixi customers to Mobile MCP until Laixi VIP available |
| Mobile MCP device unavailability | Medium | Document multi-device failover; recommend 5+ device fleet; insurance via retry budget |

---

## Success Metrics (Phase 0-1)

1. **Stability:** 5-device Instagram like-automation runs without bot detection 95% of time
2. **Anti-Detection Verified:** Random delay variation 3-8s per run (not fixed); device fingerprint changes per execution
3. **Account Tracking Accurate:** Action counts correct, warm-up stage advanced correctly, daily limit resets at UTC midnight
4. **Time-to-Market:** Phases 0-1 complete by Oct 2026 (4 months)
5. **User Feedback:** First 10 beta users report "feels like human behavior" for Instagram operations

---

## Next Steps (Ready for Planning)

1. **Create Phase 0 detailed plan** (`plans/phase-00-...`) with:
   - Rebranding copy
   - `accounts` table migration
   - Updated docs
   - Proof checklist

2. **Create Phase 1 detailed plan** with:
   - Anti-detection engine architecture
   - Account input UI mockups
   - Database queries
   - Test strategy

3. **Estimate effort:** Phase 0 (2w) + Phase 1 (6w) = 8 weeks to MVP anti-detection

4. **Identify blockers:**
   - Mobile MCP stability (test with 5+ devices for 2 weeks)
   - Account safety (Instagram ToS review, risk assessment)
   - Legal review (terms of service, liability)

---

## Unresolved Questions

1. **Instagram/TikTok API access:** Should platform use official APIs or stay with UI automation via device?
   - **Impact:** Official APIs safer but require app approval; UI automation riskier but works today
   - **Recommendation:** Start with UI automation (proven), pivot to official APIs later if customers demand

2. **Account credential storage:** Encrypt plaintext passwords or use OAuth tokens from users' social accounts?
   - **Impact:** Plaintext = privacy risk; OAuth = requires user to grant permissions, but safer
   - **Recommendation:** Start with encrypted plaintext (use Supabase secrets), migrate to OAuth later

3. **Warm-up definition:** What does a 7-day warm-up sequence look like per platform?
   - **Impact:** Too aggressive = instant detection; too conservative = slow ramp
   - **Recommendation:** Research + test with beta users; start conservative (days 1-3: 5-10 actions, days 4-7: 20-50)

4. **Failover device assignment:** If 20 accounts on 5 devices, and account A gets blocked, which device gets new run?
   - **Impact:** Bad assignment = overload some devices, underutilize others
   - **Recommendation:** Track per-device history; pick device with lowest action count + not recently used for this account

5. **Legal review needed:** Before Phase 1, social automation is higher-risk product category
   - **Recommendation:** Hire legal review; draft ToS; build abuse monitoring

---

## Appendix: Social Template Examples

### Example 1: Instagram Like Hashtag Template
```json
{
  "version": 1,
  "meta": {
    "key": "instagram_like_hashtag",
    "name": "Instagram Like Hashtag",
    "platform": "instagram",
    "tags": ["instagram", "engagement"]
  },
  "inputs": {
    "hashtag": { "type": "string", "required": true, "description": "#target" },
    "likeCount": { "type": "number", "required": true, "description": "How many posts to like" }
  },
  "antiDetection": {
    "randomDelayMs": [3000, 8000],
    "scrollVariance": true,
    "deviceFingerprint": true
  },
  "target": { "mode": "single_device" },
  "steps": [
    { "id": "launch", "type": "launch_app", "params": { "appName": "com.instagram.android" } },
    { "id": "wait_load", "type": "wait", "params": { "ms": 3000 } },
    { "id": "nav_search", "type": "tap", "params": { "x": 0.5, "y": 0.9 } },
    { "id": "search_hashtag", "type": "input_text", "params": { "text": "{{hashtag}}" } },
    { "id": "foreach_likes", "type": "foreach_device", "params": {
      "count": "{{likeCount}}",
      "steps": [
        { "id": "scroll_post", "type": "swipe", "params": { "fromX": 0.5, "fromY": 0.5, "toX": 0.5, "toY": 0.2 } },
        { "id": "wait_show", "type": "wait", "params": { "ms": "random(1000, 3000)" } },
        { "id": "tap_like", "type": "tap", "params": { "x": 0.2, "y": 0.8 } },
        { "id": "wait_action", "type": "wait", "params": { "ms": "random(2000, 5000)" } }
      ]
    } },
    { "id": "screenshot", "type": "screenshot", "params": { "saveToArtifact": true } }
  ]
}
```

---

**Status:** Ready for Phase 0 planning + legal review.
