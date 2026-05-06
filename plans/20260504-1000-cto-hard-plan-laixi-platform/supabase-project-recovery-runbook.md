# Supabase Project Recovery Runbook

Status: ready
Date: 2026-05-04
Purpose: recover the app onto a new Supabase project without rewriting the current architecture

## Recommended Decision
- Keep the current architecture:
  - React SPA
  - Supabase Postgres + Auth + RLS
  - Node execution worker
  - Node Laixi gateway
- Replace the missing old Supabase project with a new one.
- Do not rewrite to Go as part of incident recovery.

## What We Already Know
- Frontend Supabase URL can be recovered from `.env`.
- The old project URL was `https://zbksstkddsqehsgiqxdc.supabase.co`.
- The elevated backend key is not recoverable from the current machine state.
- Worker and Edge Function paths require elevated backend access.

## New Project Inputs To Collect
- Project URL
- Publishable or legacy anon key for frontend
- Secret key or legacy service_role key for backend
- Project ref for CLI linking and function deploys
- Database password if you want to use `supabase link` with remote validation

## Local Env Mapping
- Frontend:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_GATEWAY_BASE_URL`
  - `VITE_WORKER_BASE_URL`
- Backend:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GATEWAY_BASE_URL`
  - `GATEWAY_PORT`
  - `WORKER_PORT`

## Recommended Recovery Path
1. Create a new Supabase project.
2. Copy the API values from Supabase Dashboard:
   - frontend key from Connect or API Keys
   - backend elevated key from Settings > API Keys
   - prefer a new `sb_secret_...` key when available
3. Copy `.env.example` to `.env`.
4. Fill `.env` with the new project values.
5. Initialize Supabase CLI config locally if needed.
6. Link the local repo to the new Supabase project.
7. Push database migrations.
8. Deploy the `execute-run` Edge Function.
9. Start frontend, gateway, and worker against the new project.
10. Re-run device setup verification and backend smoke checks.

## CLI Sequence
- Install or use the CLI:
```bash
npx -y supabase login
```
- If the repo has no `supabase/config.toml` yet:
```bash
npx -y supabase init
```
- Link the new hosted project:
```bash
npx -y supabase link --project-ref <new-project-ref>
```
- Push migrations from `supabase/migrations`:
```bash
npx -y supabase db push
```
- Deploy the Edge Function used by run control:
```bash
npx -y supabase functions deploy execute-run
```

## Runtime Bring-Up
- Frontend:
```bash
npm.cmd run dev
```
- Gateway:
```bash
npm.cmd run dev:gateway
```
- Worker:
```bash
npm.cmd run dev:worker
```

## Verification Checklist
- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run build:gateway`
- `npm.cmd run build:worker`
- `npm.cmd run smoke:backend`
- Frontend can log in against the new project
- Macros, devices, runs, approvals, and audit pages load without Supabase auth or schema errors
- `http://127.0.0.1:8080/health` returns `status: ok`
- `http://127.0.0.1:4310/health` returns `status: ok`
- Device Setup page can reach both runtimes

## Important Notes
- The codebase currently expects the elevated backend key under the env name `SUPABASE_SERVICE_ROLE_KEY`, but the actual value can be either:
  - a legacy `service_role` JWT key
  - a newer `sb_secret_...` key
- Do not expose the elevated backend key to the browser.
- Do not block recovery on data migration if the main goal is restoring platform operation first.

## Decision After Recovery
- If the new Supabase project restores the product quickly and stays within pilot load, keep the current architecture.
- Revisit Go only as a controlled phase for worker/gateway replacement, not as incident response.

## Unresolved Questions
- Do we need old production data badly enough to justify a separate export-recovery effort?
- Will the new Supabase project be Free for dev only, or Pro for live pilot bring-up?
