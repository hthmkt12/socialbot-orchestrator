# Phase 7: Concrete Social Media Bots

## Context
We have built a strong orchestration platform (devices, execution worker, schedules, auto-advancement). However, the actual macro payload execution currently relies on basic mocked steps or simple JSON templates. To provide real value, we need to implement concrete, working social media bots (Instagram, TikTok, etc.) using the Mobilerun backend and `ai_task` capabilities we built in Phase 2.

## Goals
1. Transition from theoretical macro templates to actual working bot sequences.
2. Implement robust Instagram automation (e.g., Hashtag Likers, Follower Builders).
3. Implement robust TikTok automation (e.g., Feed Scrollers, Auto-Likers).
4. Integrate the anti-detection features (random delays, scroll variance) into the execution worker steps.

## Requirements

### 1. Robust Macro Templates
- Define concrete JSON templates in the database/seed scripts for:
  - `instagram_warmup`: Scrolls feed, likes randomly, pauses.
  - `instagram_hashtag_engage`: Searches hashtag, likes top N posts, comments conditionally.
  - `tiktok_view_bot`: Scrolls FYP, pauses for watch time, randomly likes.

### 2. Execution Engine Enhancements
- Expand the worker's `Macro` interface to support dynamic `randomDelayMs`, `scrollVariance`, and conditionally executed `steps`.
- Implement a `foreach_device` / loop step type in `single-device-step-runner.ts` that loops through sub-steps (e.g., loop 5 times to scroll and like).

### 3. Leverage `ai_task` (MobileAgent)
- Use the `ai_task` step for complex, brittle operations where coordinates might fail. 
- Example: "Find the like button and tap it" instead of hardcoding `(0.2, 0.8)`.

## Implementation Steps

### Step 1: Update Macro Schema & Runner
- Update `Macro` types in `src/contracts/macro.ts` to support `antiDetection` block (random delays, variance).
- Add support for `loop` / `foreach` step types to iterate over a block of steps.
- Modify `single-device-step-runner.ts` to respect anti-detection delays between steps automatically.

### Step 2: Seed Concrete Macros
- Create a migration or seed script (`supabase/migrations/20260627000005_social_macros.sql`) to insert the concrete Instagram and TikTok macro templates into the `macros` table.

### Step 3: Implement `loop` execution logic
- In `single-device-step-runner.ts`, handle the `loop` step type by unrolling or recursively executing the child steps `N` times, ensuring budget checks and anti-detection delays are applied inside the loop.

### Step 4: UI Surfacing
- Update the `MacroDetailPage` to properly display the `antiDetection` settings and complex loop steps so users can see the bot's behavior.

## Verification
- Seed the DB.
- Open the Macros page and verify the new Instagram/TikTok bots appear and show the correct looping structures.
- Trigger a run of the "Instagram Warmup" macro and verify the worker unrolls the loop and processes it correctly (logs should show the delays and repeated steps).
