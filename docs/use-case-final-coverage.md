# Use Case Final Coverage

Source of truth:

- `docs/use-cases.md`
- `docs/use-cases-architecture-spec.md`
- `docs/use-case-coding-sequence.md`

Status legend:

- `covered`: has an implemented UI/service/worker/bridge rule or focused test.
- `partial`: guardrail exists, but full product surface or live proof remains intentionally outside current MVP.
- `not covered`: no meaningful implementation or guard found.

## Role / Flow Coverage

| ID range | Status | Evidence |
| --- | --- | --- |
| `VIS-CAN-001..004` | covered | `src/App.tsx`, `src/pages/LoginPage.tsx`, `src/stores/auth.ts`, `tests/e2e/visitor-auth.spec.ts`, `src/stores/auth.test.ts` |
| `VIS-NO-001..004` | covered | Auth redirect, no internal routes without session, profile role managed behind app/DB boundaries |
| `VIS-ERR-001..004` | covered | Auth store fail-closed handling and visible auth errors |
| `VIEW-CAN-001..011` | covered | Viewer read-only pages and notices across accounts/devices/macros/runs/approvals/schedules/audit nav; readiness report list; analytics source labels; retry timeline read-only |
| `VIEW-NO-001..009` | covered | `src/lib/role-access.ts`, page action disables, readiness report submit/review disabled, `tests/e2e/viewer-readonly.spec.ts` |
| `VIEW-ERR-001..006` | covered | Run preflight blocks, read-only notices, safe empty/error states, artifact preview fallback, analytics insufficient-data source label |
| `OP-CAN-001..005` | covered | Account/social dashboard flows, CSV import/create affordances, account history |
| `OP-CAN-006..024` | covered | Device, macro, run, approval, Mobile MCP, schedule, analytics, pilot readiness report submit/view, retry timeline, and target-failure summary surfaces |
| `OP-NO-001..012` | covered | Admin governance service, approval gates, preflight, bridge auth, Mobile MCP `run_autox` block, admin-only readiness review, execution-profile retry limits, dispatchable-target policy |
| `OP-ERR-001..014` | covered | CSV/account validation, preflight, bridge error mapping, approval resolved handling, terminal cancel no-op, readiness evidence secret scrubbing |
| `SCH-CAN-001..004` | covered | `src/lib/schedule-service.ts`, `services/execution-worker/src/workflow-schedule-trigger.ts` |
| `SCH-NO-001..004` | covered | Scheduler only queues runs, role-guarded schedule service, worker approval gate |
| `SCH-ERR-001..004` | covered | Invalid cron/timezone/macro/target handling; schedule loop logs and continues |
| `AD-CAN-001..004` | covered | Admin inherits operator permissions, audit all-scope, profile role read/update service |
| `AD-CAN-005` | covered | Admin execution profile UI/service exists and focused tests cover fetch/create/update/delete/validation in `src/lib/execution-profile-service.test.ts` |
| `AD-CAN-006` | covered | Admin-only delete guard covers devices, device groups, macros, and execution profiles with dependency checks and audit logging |
| `AD-CAN-007` | covered | Device Setup lock cleanup flow covers operator expired-lock cleanup and admin-only force clear for active locks |
| `AD-CAN-008` | covered | Deployment/env secret configuration is documented in `.env.example`, `README.md`, and `docs/deployment-guide.md`; secrets stay outside app runtime |
| `AD-CAN-009` | covered | `scripts/verify-mobile-mcp-local.mjs` writes timestamped verification reports under `plans/reports/` for pilot readiness review |
| `AD-CAN-010` | covered | Bridge health exposes `authRequired`/`insecureDevMode`; `bridge_auth_status` test covers explicit local insecure-mode decisions |
| `AD-CAN-011` | covered | `src/pages/ReadinessReportsPage.tsx`, `src/lib/readiness-report-service.ts`, and tests cover admin pilot readiness review decisions |
| `AD-CAN-012` | covered | Admin execution profile UI/service/migration cover retry/backoff policy configuration |
| `AD-CAN-013` | covered | Admin execution profile UI/service/migration cover target failure policy configuration |
| `AD-NO-001..010` | covered | Auth/RLS boundary, no plaintext credential UI, product guardrails, artifact policy, no pricing/billing runtime route, readiness verification evidence gate, no infinite retry config, valid target failure policy enum |
| `AD-ERR-001..009` | covered | Role validation, dependency delete guard, bridge 401, artifact threshold policy, env-risk docs, readiness verification missing-evidence rejection, retry/backoff validation, target failure policy validation |
| `WORK-CAN-001..008` | covered | Claim coordinator, lease/heartbeat, target context, backend execution, approval pause, cancellation |
| `WORK-CAN-009..011` | covered | Worker-level tests cover action budget enforcement, account action history recording, and block-signature account marking |
| `WORK-CAN-012` | covered | Run result aggregation and finalize helpers |
| `WORK-CAN-013..014` | covered | Worker retry/backoff policy helper and single-device runner tests cover bounded retries and retry metadata persistence |
| `WORK-CAN-015..016` | covered | Multi-target worker applies `fail_fast`/`skip_failed_target` and persists target failure decisions in summary |
| `WORK-NO-001..008` | covered | Claim token checks, device lock, approval gate, credential scope guard, sequential path, unsupported step check, bounded retry policy, original failure preservation |
| `WORK-ERR-001..008` | covered | Device lock, timeout, bridge failure, cancel, approval wait, exception finalization, schedule loop safety, fail-fast skipped targets |
| `BR-CAN-001..007` | covered | Bridge health/devices/execute-step/auth mode, ADB-first session, optional Portal setup |
| `BR-NO-001..005` | covered | Token auth, iOS ADB-only guard, Portal opt-in, device-level boundary, per-session mutex |
| `BR-ERR-001..006` | covered | Python bridge tests for token/session/package/platform/screenshot failures plus TS backend mapping |

## Out-Of-Scope Guardrails

| ID | Status | Evidence |
| --- | --- | --- |
| `OOS-001` | covered | No marketplace route/table; `isOutOfScopeRoute` blocks marketplace paths |
| `OOS-002` | covered | No pricing/billing page; billing/payment/checkout routes are blocked by guardrail |
| `OOS-003` | covered | Public social graph/network routes are blocked; social actions remain workflow/account operations |
| `OOS-004` | covered | No collaboration route/table; collaboration path blocked |
| `OOS-005` | covered | Docs/product copy keep anti-bot safety as non-guaranteed |
| `OOS-006` | covered | No production credential vault route; encrypted pilot payload only |
| `OOS-007` | covered | No account purchase/auto-create marketplace |
| `OOS-008` | covered | Sensitive steps remain approval-gated |
| `OOS-009` | covered | Mobile MCP V1 blocks `run_autox` |
| `OOS-010` | covered | Device bridge live readiness remains proof-gated in docs and verification report workflow |
| `OOS-011` | covered | iOS readiness remains Portal + iproxy proof-gated; bridge blocks iOS ADB-only steps |
| `OOS-012` | covered | Worker artifact threshold policy omits large inline DB payloads |
| `OOS-013` | covered | No external customer sharing/export package route |
| `OOS-014` | covered | Sequential pilot path remains accepted; no fleet parallel SLA claim |
| `OOS-015` | covered | Web app only; native-mobile paths blocked |
| `OOS-016` | covered | Runtime connectivity required; offline-first paths blocked |

## Remaining Partial Items

- None.

## Verification Commands

- `npm.cmd run test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run build:worker`
- `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`
- `python -m py_compile services\mobile-mcp-bridge\src\android_session_manager.py services\mobile-mcp-bridge\src\bridge_server.py services\mobile-mcp-bridge\src\json_response.py`
