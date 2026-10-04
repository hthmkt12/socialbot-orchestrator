# Social Fleet Operator Runbook

**Date:** 2026-10-04  
**Target Audience:** Fleet Operators, Growth Engineers, and QA Technicians managing 5–50 physical Android/iOS automation devices.  
**Scope:** Device preparation, account lifecycle management, campaign scheduling, anti-detection safety limits, and checkpoint incident response.

---

## 1. Quick Start Topology

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│  Operator Web UI│ <---> │  Supabase DB & Vault │ <---> │ Node.js Execution      │
│  (Port 5173)    │       │  (Auth, RPC, RLS)    │       │ Worker (Port 4310)     │
└─────────────────┘       └──────────────────────┘       └───────────┬────────────┘
                                                                     │
                                                         HTTP/WS Step Dispatch
                                                                     │
                                                         ┌───────────▼────────────┐
                                                         │ Mobile MCP Bridge      │
                                                         │ (Port 4321 / ADB)      │
                                                         └───────────┬────────────┘
                                                                     │
                                                        ┌────────────┴────────────┐
                                                        │ Physical Android Device │
                                                        │ (Redmi 13C / Serial)    │
                                                        └─────────────────────────┘
```

---

## 2. Infrastructure Setup & Environment Verification

### 2.1 Start Local Runtime Bridge & Execution Worker
To start the Mobile MCP bridge and local execution worker with automated health monitoring:

```powershell
# In project root:
npm run setup:mobile-mcp:quick
```

Or start the individual components:

```bash
# 1. Start Mobile MCP bridge runtime (Python AndroidDriver)
npm run runtime:mobile-mcp

# 2. In another terminal, start the execution worker
npm run dev:worker
```

### 2.2 Verify Device Connectivity
Check connected ADB devices and verify status:

```bash
adb devices -l
# Expected output includes device serial, e.g.:
# QC4DKJUO6PW4FMQW       device product:air_global model:23106RN0DA device:air

# Run doctor diagnostic
npm run diagnose:mobile-mcp:devices
```

### 2.3 Worker Health Gate
Verify worker and scheduler health endpoint:
```bash
curl http://127.0.0.1:4310/health
# Expected JSON response:
# {"status":"ok","uptime":...,"accountWarmupScheduler":"running","deviceBackend":"mobile-mcp"}
```

---

## 3. Account Onboarding & Vault Security

### 3.1 Account Lifecycle & Warm-Up Stages

| Stage | Duration | Daily Action Limit | Allowed Action Types | Focus |
|:---:|:---:|:---:|:---:|:---|
| **1** | Days 1–3 | 5 actions/day | App Launch, Feed Read | Passive browse, zero interactions |
| **2** | Days 4–7 | 15 actions/day | Read, Likes (max 10) | Mild passive engagement |
| **3** | Days 8–14 | 30 actions/day | Likes, Follows (max 10) | Profile follow ramp |
| **4** | Days 15–30 | 50 actions/day | Likes, Follows, Comments (max 10) | Full social engagement |
| **5** | Day 30+ | 100 actions/day | Full automation suite | Production scale |

### 3.2 Adding Accounts via UI or CSV Import
1. Navigate to `/accounts` in the Operator Dashboard.
2. Click **New Account** or **Import Accounts (CSV)**.
3. Required columns for CSV import:
   - `username`: Social platform handle.
   - `platform`: `instagram` | `tiktok` | `facebook`.
   - `password`: Transmitted over TLS to server-side `credential-vault` Edge Function for `s3:` encryption. Never stored in plaintext.
   - `warm_up_stage`: Defaults to `1`.
4. Accounts auto-populate in the **Social Dashboard** (`/`) with real-time budget tracking.

---

## 4. Launching & Scheduling Campaigns

### 4.1 Manual Run Dispatch via Run Wizard
1. Navigate to `/runs` and click **New Run**.
2. **Step 1 (Select Macro):** Choose a verified starter macro:
   - `instagram_warmup` (Feed scroll + human pauses)
   - `instagram_hashtag_engage` (Search tag, scroll, like top post)
   - `tiktok_view_bot` (Video watch-time loop + like)
3. **Step 2 (Target Device):** Select online target device.
4. **Step 3 (Account & Safety):**
   - The wizard validates account health. Quarantined accounts (`is_blocked = true`) are highlighted with warning badges and cannot be dispatched.
   - Select an eligible account with remaining action budget.
5. **Step 4 (Variables):** Fill macro inputs (e.g. hashtags, search terms).
6. **Step 5 (Preflight & Submit):** Wizard evaluates preflight checks and dispatches. The operator is redirected to `/runs/{id}/monitor` for live telemetry.

### 4.2 Automated Cron Scheduling
To set up continuous unattended execution:
1. Navigate to `/schedules`.
2. Click **Create Schedule**.
3. Configure:
   - **Target Device or Group**: Target individual devices or dynamic device pools.
   - **Macro & Version**: Pinned workflow version.
   - **Cron Expression**: e.g., `0 */2 * * *` (every 2 hours during daytime).
4. The execution worker's `WorkflowScheduleTrigger` background loop evaluates pending schedules, locks devices via hardware mutex, and executes runs automatically.

---

## 5. Anti-Detection & Safety Mechanisms

### 5.1 Pre-Execution Action Budget Cutoff
Before any hardware touch or gesture is dispatched, the worker queries `canPerformAction(account)`. If daily quotas are exceeded:
- Step fails immediately with code `BUDGET_EXCEEDED`.
- Zero touch events or gestures reach the device.
- Prevents platform rate-limit penalties.

### 5.2 Automatic Action Counter Reset
- Action counters (`current_action_count`) reset to `0` at `00:00:00 UTC` every day.
- Handled automatically by the worker's `AccountWarmupScheduler`.
- When an account completes its required days in a stage, it is promoted to the next stage with increased daily limits.

### 5.3 Single-Device Hardware Mutex
- Every run acquires a device lock in `device_locks` table.
- Concurrent runs targeting the same physical device are rejected with `DEVICE_LOCKED`.
- Locks release automatically in the worker's `finally` block on completion or error.
- Expired or stale locks (>30 minutes) are automatically purged.

---

## 6. Incident Response & Troubleshooting

### 6.1 Checkpoint Auto-Block Quarantine
When a social platform challenges an account (e.g. "Action Blocked", "Try Again Later", "Help Us Confirm It's You"):
1. The worker's `account-block-detector` detects platform restriction indicators in OCR or step error outputs.
2. The account's database record is updated immediately:
   - `is_blocked = true`
   - `detected_block_reason = '<error text>'`
3. All subsequent runs for this account fail closed.

### 6.2 Operator Resolution Journey (One-Click Unblock)
1. Open the Operator Dashboard (`/`) or Accounts page (`/accounts`).
2. The blocked account displays an alert badge: **Restricted: Action Blocked**.
3. Click the account to view the **Account Health Card**.
4. The operator physically inspects the device, solves any visual captcha or SMS verification manually on the phone screen.
5. In the UI, click **Resolve & Unblock Account**.
6. The system clears `detected_block_reason` to `null`, resets `is_blocked` to `false`, and records an audit log entry.
7. Account is immediately eligible for new runs.

### 6.3 Stale Lock Clearance
If a worker crashes mid-run and leaves a hardware device locked:
1. Navigate to `/devices`.
2. Inspect the device lock badge.
3. If locked by an inactive run, click **Release Lock** to clear the lock record.
4. The worker background cleaner also clears stale locks automatically every 60 seconds.

---

## 7. Metrics & Analytics Verification

1. Navigate to `/analytics`.
2. Verify daily metrics:
   - **Daily Actions**: Total social interactions completed.
   - **Action Distribution**: Breakdown by Likes, Follows, Comments, Posts, Views.
   - **Success vs. Failure Rate**: Ensure success rate remains > 95%.
   - **Recent Device Errors**: Review root causes for any failed steps.
3. If errors spike, pause active schedules and inspect physical device screens for app updates or UI layout changes.
