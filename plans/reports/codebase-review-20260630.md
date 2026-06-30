# Codebase Review — SocialBot Orchestrator

**Date:** 2026-06-30
**Scope:** Full codebase scan
**Verification:** typecheck ✅ | lint 12 errors (test-only `as any`) | 156/156 tests pass | build ready

---

## Codebase Stats

| Layer | Files | Lines | Largest file |
|-------|-------|-------|-------------|
| Frontend (src/) | ~80 .tsx/.ts | ~27k | `single-device-step-runner.ts` 802 (backend shared import) |
| Execution Worker | ~28 .ts | ~5.1k | `single-device-step-runner.ts` 802 |
| Laixi Gateway | 3 .ts | 528 | `gateway-session-manager.ts` 339 |
| Mobile MCP Bridge | 3 .py | 536 | `android_session_manager.py` 390 |
| Shared Packages | 4 .ts | 638 | `execution-contract.ts` 277 |
| Supabase Migrations | 14 .sql | ~3k | `extend_seed_macros.sql` 454 |
| Scripts | ~20 .mjs/.ps1 | ~2.4k | `start-mobile-mcp-local-runtime.mjs` 263 |

---

## CRITICAL Findings

### C1. Passwords stored as plaintext in database

**File:** `src/components/accounts/create-account-modal.tsx:29`, `supabase/migrations/20260627000001_account_tables.sql:26`

Column named `encrypted_password` but code sends raw password from UI form:
```tsx
encrypted_password: password, // raw user input, no encryption
```
No encryption/hashing happens client-side or server-side. RLS `INSERT` policy just checks `auth.uid() = user_id`. Any user with DB access sees plaintext social account passwords.

**Risk:** Credential exposure. If Supabase is compromised or admin reads DB, all social account passwords leak.

**Fix:** Encrypt client-side before insert (e.g. `crypto.subtle.encrypt` with user-derived key) or use Supabase Vault / pgcrypto `pgp_sym_encrypt()` with a server-side secret.

---

### C2. Mobile MCP bridge has no authentication

**File:** `services/mobile-mcp-bridge/src/bridge_server.py`

Bridge binds to `127.0.0.1:4321` with zero auth. Any local process can:
- Execute arbitrary ADB commands via `POST /devices/{serial}/execute-step` with `stepType: "adb"`
- Run any tool via `POST /devices/{serial}/tools/call`
- List all connected devices via `GET /devices`

**Risk:** Local privilege escalation. Any malware or process on workstation can execute ADB commands on connected phones.

**Fix:** Add shared secret header validation (e.g. `X-Bridge-Token`) or Unix socket auth.

---

### C3. Gateway and Bridge CORS set to `*`

**File:** `services/laixi-gateway/src/index.ts:54`, `services/mobile-mcp-bridge/src/bridge_server.py:85`

```
access-control-allow-origin: *
```

Both services accept requests from any origin. Combined with no auth on bridge, any webpage opened on the workstation could execute ADB commands.

**Risk:** Cross-origin device command injection from browser tabs.

**Fix:** Restrict to `http://localhost:5173` or require auth token.

---

## IMPORTANT Findings

### I1. No React Error Boundary

Zero `ErrorBoundary` components in entire `src/`. Any uncaught render error crashes the full app with a blank screen.

**Fix:** Add error boundary at `AppLayout` level minimum.

### I2. `single-device-step-runner.ts` is 802 lines

Exceeds 200-line project guideline by 4x. Contains loop handling, try-catch handling, foreach, while-loop, approval gates, retry logic, action budget, and step recording — all in one class.

**Fix:** Extract control-flow handlers (`handleLoop`, `handleForeachLoop`, `handleWhileLoop`, `handleTryCatch`) into separate modules.

### I3. Root-level orphan fix/patch scripts

**Both directories** contain abandoned fix scripts:
- `project/`: `fix_device_id.cjs`, `fix_fleet_page.cjs`, `fix_sidebar.cjs`, `fix_sidebar2.cjs`, `patch_fleet_imports.cjs`
- Root: `fix_account_detail.js` (×5), `patch_runner.js`, `patch_sample_macros.js`, `patch_templates.js`

These are one-shot code-mod scripts left behind. They reference specific file paths and do `fs.readFileSync` → regex replace → `fs.writeFileSync`.

**Fix:** Delete all. They've served their purpose and clutter the workspace.

### I4. CSV import sends passwords in sequential requests without batching

**File:** `src/pages/AccountsPage.tsx:63-76`

```tsx
for (const row of rows) {
  await createAccount.mutateAsync({ ...row });
}
```

Serially awaits one `INSERT` per row. 100-account CSV = 100 sequential Supabase calls. No transaction, no batch, no progress indicator.

**Fix:** Use `supabase.from('accounts').insert(rows)` for batch insert.

### I5. `useAuth` hook calls `store.initialize()` on every mount without deps guard

**File:** `src/hooks/useAuth.ts:7-10`

```tsx
useEffect(() => {
  store.initialize();
}, []);
```

`store` is excluded from deps (ESLint disabled). If `useAuth` is used in multiple components, `initialize()` fires multiple times. The `authListenerRegistered` flag in the store prevents duplicate listeners but still re-fetches session + profile on each mount.

**Risk:** Unnecessary network calls on mount.

### I6. `account_action_history` INSERT policy is overly permissive

**File:** `supabase/migrations/20260627000001_account_tables.sql:114-117`

```sql
CREATE POLICY "Authenticated can insert action history"
  ON account_action_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

Any authenticated user can insert action history for ANY account, not just their own.

**Fix:** Add `WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_action_history.account_id AND accounts.user_id = auth.uid()))`.

### I7. Gateway session manager `setInterval` never cleaned up

**File:** `services/laixi-gateway/src/gateway-session-manager.ts:76`

```ts
setInterval(() => { ... }, intervalMs).unref();
```

`unref()` prevents Node from staying alive for the timer, but there's no way to stop the freshness loop. If sessions are cleared or gateway shuts down, the interval keeps firing on dead references.

**Fix:** Store interval ID, add `stopFreshnessLoop()` method.

### I8. Worker run-claim coordinator has no graceful shutdown

**File:** `services/execution-worker/src/run-claim-coordinator.ts:61`

```ts
setInterval(() => void this.poll(), this.config.pollIntervalMs).unref();
```

No `SIGTERM`/`SIGINT` handler. Active claims aren't released on shutdown, leaving runs stuck until lease expires.

**Fix:** Add signal handler that releases active claims and stops polling.

---

## MINOR Findings

### M1. Lint errors are all in test files (`as any` casts)

12 ESLint errors, all `@typescript-eslint/no-explicit-any` in test files. Acceptable for test mocks but could use typed mocks.

### M2. `MacroStep.params` typed as `Record<string, unknown>`

**File:** `src/contracts/macro.ts:39`

Step params are untyped. Each step type has different param shapes but all go through `Record<string, unknown>`. Forces runtime string casting everywhere.

**Fix:** Discriminated union on `StepType` with typed params per step.

### M3. `database.types.ts` is manually maintained

260 lines of hand-written interfaces. Supabase CLI can generate these with `supabase gen types typescript`. Manual types risk drift from actual schema.

### M4. `queryClient` defined outside React tree in `App.tsx`

**File:** `src/App.tsx:37`

Module-level singleton. Works fine for SPA but prevents SSR and makes testing harder.

### M5. `definition_json` and `input_schema_json` typed as `Record<string, unknown>`

**File:** `src/lib/database.types.ts:69-70`

These should be `MacroDefinition` and `Record<string, MacroInputField>` for type safety.

### M6. `supabase.ts` doesn't validate env vars

**File:** `src/lib/supabase.ts`

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

No runtime check. If env missing, `createClient` gets `undefined` and fails with cryptic error.

---

## Architecture Assessment

**Strengths:**
- Clean separation: frontend → Supabase → worker → device backends
- Good use of lazy loading for all route pages
- Proper RLS on 13+ tables with role-based policies
- Robust step execution with retry, timeout, approval gates, and cancellation
- Anti-detection layer (coordinate jitter, delays) well integrated
- Shared contracts package prevents drift between worker and frontend
- 156 unit tests covering core engine logic

**Weaknesses:**
- Security surface not hardened for multi-user production (plaintext passwords, permissive bridge)
- No error boundaries = fragile UI
- Worker has no graceful shutdown
- Step runner monolith (802 lines) will grow as step types are added
- Manual DB types risk schema drift

---

## Recommended Priority

1. ~~**C1** — Encrypt passwords~~ ✅ FIXED
2. ~~**C2+C3** — Auth + CORS on bridge/gateway~~ ✅ FIXED
3. ~~**I1** — Add error boundary~~ ✅ FIXED
4. ~~**I6** — Fix action history RLS~~ ✅ FIXED
5. ~~**I2** — Split step runner~~ ⏭️ Deferred (tight coupling, high-risk refactor)
6. ~~**I3** — Delete orphan scripts~~ ✅ FIXED
7. ~~**I8** — Graceful worker shutdown~~ ✅ FIXED
8. I4, I5, I7, M4, M5, M6 also completed alongside above

### Deferred
- **I2** — Split `single-device-step-runner.ts` (802 lines): Handler methods tightly coupled to runner internals. Extraction requires significant refactor. Consider in future when step types grow further.

---

## Fix Summary (2026-06-30)

### CRITICAL
| Finding | Fix | Files |
|---------|-----|-------|
| C1: Plaintext passwords | AES-GCM encryption via Web Crypto API, wired into create modal + CSV import (both pages) | `account-password-crypto.ts` (new), `create-account-modal.tsx`, `AccountsPage.tsx`, `AccountSetupPage.tsx` |
| C2: Bridge no auth | `X-Bridge-Token` header validation, env var `MOBILE_MCP_BRIDGE_TOKEN`, worker passes token | `bridge_server.py`, `mobile-mcp-step-backend.ts`, `mobilerun-step-backend.ts`, `device-step-backend-factory.ts`, `run-claim-coordinator.ts`, `index.ts` |
| C3: Wildcard CORS | Restrict to `http://localhost:5173` via env vars on bridge, gateway, worker | `bridge_server.py`, `gateway/index.ts`, `worker/index.ts`, `.env.example` |

### IMPORTANT
| Finding | Fix | Files |
|---------|-----|-------|
| I1: No Error Boundary | Class component ErrorBoundary wrapping AuthGate | `components/ui/ErrorBoundary.tsx` (new), `App.tsx` |
| I3: Orphan scripts | Deleted 13 files (fix_*.cjs, patch_*.cjs, fix_*.js, patch_*.js) | `project/`, root |
| I4: Serial CSV import | `createAccountsBatch()` + `useBatchCreateAccounts` hook, `Promise.all` encryption | `account-service-helpers.ts`, `use-accounts.ts`, both page files |
| I5: useAuth init race | `initializePromise` deduplication — reuse in-flight init | `stores/auth.ts` |
| I6: Permissive RLS | New migration: INSERT restricted to own accounts only | `20260630000001_fix_action_history_rls.sql` (new) |
| I7: Gateway interval leak | `stopFreshnessLoop()`, interval ID stored | `gateway-session-manager.ts` |
| I8: No graceful shutdown | `coordinator.stop()`, SIGTERM/SIGINT handlers | `run-claim-coordinator.ts`, `worker/index.ts` |

### MINOR
| Finding | Fix | Files |
|---------|-----|-------|
| M4: queryClient scope | Moved queryClient instantiation inside App component tree | `App.tsx` |
| M5: definition_json types | Typed definition_json and input_schema_json strictly | `database.types.ts` |
| M6: env var validation | Added check for VITE_SUPABASE_URL and ANON_KEY | `supabase.ts` |

---

## Unresolved Questions

1. ~~Is `encrypted_password` name intentional?~~ Confirmed: misnomer, encryption was never implemented. ✅ Now actually encrypted.
2. ~~Are the `fix_*.cjs` / `patch_*.cjs` files needed by CI/CD?~~ No — deleted all 13.
3. ~~Is the bridge intended for dev only?~~ Added auth anyway (C2) — defense in depth.
