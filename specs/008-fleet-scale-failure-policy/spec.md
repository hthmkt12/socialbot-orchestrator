# Feature Specification: Fleet Scale And Failure Policy

Date: 2026-07-07
Status: draft

## Purpose

Define the first acceptable fleet pilot and how the system behaves when one target fails.

## Scale Decision

Level 3 fleet pilot defaults to 5 Android devices.

Sequential execution is acceptable for pilot unless the project owner separately specifies a measured parallel speed SLA.

## In Scope

- Android Mobile MCP fleet pilot.
- Device group or multi-device target selection.
- Dispatchable-target filtering.
- `fail_fast` and `skip_failed_target` behavior.
- Per-target outcome summary.
- Retry/backoff policy interaction.

## Out Of Scope

- 50-device production scale claim.
- Parallel speed SLA.
- Cross-platform Android+iOS fleet.
- Laixi fleet readiness.
- Automatic purchase/creation of accounts or devices.
- Failover to unsafe account/device targets.

## Data Model

Use existing execution profile and run summary fields where possible.

Required conceptual fields:

- `execution_profiles.target_failure_policy`: `fail_fast` or `skip_failed_target`.
- `workflow_runs.target_summary_json`: per-target status, skipped count, failed count, completed count.
- `run_steps.target_device_id` or equivalent target context.
- `run_steps.error_json.original_failure`.
- `run_steps.output_json.failure_policy_decision`.

If future failover is implemented, add explicit fields:

- `fallback_target_id`
- `fallback_reason`
- `fallback_decision`

## Permissions

| Role | Permissions |
| --- | --- |
| Visitor | No access. |
| Viewer | View fleet run summary read-only. |
| Operator | Select allowed multi-target/device-group run and choose allowed failure policy. |
| Admin | Configure default target failure policy and max pilot target count. |
| System Worker | Enforce resolved targets, locks, retry/backoff, and failure policy. |

## Routes And Endpoints

Use existing routes where possible:

- `/runs/new`: select device group/multi-device target and policy.
- `/runs/:id`: per-target result and skipped/failure decisions.
- `/devices`: inspect device dispatchability.
- `/admin/execution-profiles`: configure policy defaults if exposed.

## Use Cases

### Operator Can

- La operator, toi co the chon multi-device hoac device group cho Level 3 pilot.
- La operator, toi co the xem target nao duoc dispatch, target nao bi loai va ly do.
- La operator, toi co the chon `fail_fast` hoac `skip_failed_target` neu admin policy cho phep.
- La operator, toi co the xem per-target outcome sau run.

### Operator Cannot

- La operator, toi KHONG THE chon device offline, stale, locked, hoac capability-incompatible lam dispatch target.
- La operator, toi KHONG THE claim fleet SLA neu chua co measured SLA spec.
- La operator, toi KHONG THE failover sang account blocked, over budget, hoac sai platform.
- La operator, toi KHONG THE bypass max pilot device count.

### Admin Can

- La admin, toi co the cau hinh default target failure policy.
- La admin, toi co the cau hinh max pilot device count trong gioi han MVP.

### Admin Cannot

- La admin, toi KHONG THE cau hinh failure policy ngoai `fail_fast` hoac `skip_failed_target`.
- La admin, toi KHONG THE set max pilot device count thanh unlimited.

### System Worker Can

- La system worker, toi co the stop remaining targets khi policy la `fail_fast`.
- La system worker, toi co the skip failed target va tiep tuc target con lai khi policy la `skip_failed_target`.
- La system worker, toi co the persist original failure va policy decision.

### System Worker Cannot

- La system worker, toi KHONG THE che dau original failure.
- La system worker, toi KHONG THE execute tren target khong nam trong resolved dispatchable targets.

### Error Cases

- Khi no dispatchable target exists, launch/preflight fails.
- Khi target lock acquire fails, target result is failed/skipped according to policy.
- Khi invalid policy is configured, run fails with config error before dispatch.
- Khi max device count exceeded, preflight blocks launch with configured limit.

## Acceptance Criteria

- Fleet pilot target count is explicit before launch.
- Default Level 3 target count is 5 Android devices.
- Dispatch target list excludes offline/stale/locked/incompatible devices.
- Failure policy is persisted with the run or execution profile.
- Run summary shows completed, failed, skipped, and original failure reasons.
- No copy claims fleet speed SLA.

## Verification

- Unit test for dispatchable-target filtering.
- Unit test for invalid target failure policy.
- Worker test for `fail_fast`.
- Worker test for `skip_failed_target`.
- Scripted or E2E output showing target count, selected policy, and per-target summary.
