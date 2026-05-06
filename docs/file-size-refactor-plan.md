# File Size Refactor Plan

Date: 2026-05-05

Purpose: reduce large-file risk without destabilizing verified Mobile MCP runtime.

## Current Largest Source Files

| File | Lines | Priority | Refactor Boundary |
| --- | ---: | --- | --- |
| `src/lib/database.types.ts` | 181 | P4 | Generated/contract-heavy file; only split if type ownership becomes unclear. |
| `src/contracts/sample-macros.ts` | 166 | P4 | Monitor only; split only if fixture ownership stops fitting one sample contract module. |
| `src/engine/runner.ts` | 128 | P4 | Monitor only; split only if lock lifecycle, screenshot capture, persistence wiring, and execute-for-device orchestration regrow together. |
| `src/components/runs/RunWizard.tsx` | 149 | P4 | Monitor only; split only if modal shell orchestration regrows beyond the current layout, navigation, and submit helpers. |
| `src/engine/orchestrator.test.ts` | 145 | P4 | Monitor only; split only if test scenarios or helper assertions regrow together again. |
| `src/components/macros/macro-builder-step-card-sections.tsx` | 145 | P4 | Monitor only; split only if step-card header controls and policy field controls regrow together. |
| `src/pages/ApprovalsPage.tsx` | 143 | P4 | Monitor only; split only if page-level orchestration regrows beyond the extracted approval tabs, cards, and detail modules. |
| `src/engine/runner-device-step.ts` | 143 | P4 | Monitor only; split only if device-step execution, retry flow, and artifact capture regrow together. |
| `src/pages/RunMonitorPage.tsx` | 127 | P4 | Monitor only; split only if page wiring regrows beyond the current summary, header, device list, polling modules, and shell states. |
| `src/adapters/laixi/client.ts` | 142 | P4 | Monitor only; split only if connection lifecycle, pending-request state, and request dispatch regrow together. |
| `src/pages/DevicesPage.tsx` | 141 | P4 | Monitor only; split only if page orchestration regrows beyond the extracted device helper modules and shell sections. |
| `src/lib/run-preflight-target-issues.ts` | 140 | P4 | Monitor only; split only if issue classification and user-facing warning text regrow together. |
| `src/components/runs/run-wizard-step-content.tsx` | 137 | P4 | Monitor only; split only if step-switch routing and per-step prop wiring regrow together. |
| `src/lib/device-setup-autojs.ts` | 135 | P4 | Monitor only; split only if script chunk builders and bootstrap template assembly regrow together. |
| `src/engine/orchestrator.ts` | 133 | P4 | Monitor only; split only if lifecycle wiring, persistence updates, and device aggregation regrow together. |
| `src/components/device-setup/device-setup-verify-tab.tsx` | 132 | P4 | Monitor only; split only if verify-tab composition regrows beyond diagnostics, runtime endpoint, and live-probe panel wiring. |
| `src/components/device-setup/device-setup-page-tab-content.tsx` | 132 | P4 | Monitor only; split only if page-tab routing regrows beyond verify/guide/protocol/troubleshoot composition. |
| `src/components/demo/DemoStepExecutionPanel.tsx` | 129 | P4 | Monitor only; split only if step progress, live logs, and result cards regrow together. |

## Refactor Order

1. `DeviceSetupPage`: extract read-only display panels first; leave mutation/control hooks in place until tests pass.
2. `RunWizard`: extract pure sections with typed props before changing submit logic.
3. `RunMonitorPage`: extract presentation panels only; keep polling/control semantics unchanged.
4. `DevicesPage`: extract risk cohort display after role-access behavior remains verified.
5. Shared libs/engine: runtime files are now below 200 lines; only refactor further with focused tests or smoke coverage.
6. Keep new feature work from regrowing `ApprovalDialog`, `useRuns`, `RunWizard`, or Demo configuration UI after these focused splits.

## Guardrails

- Preserve existing route paths and user-visible workflows.
- No new "enhanced" duplicate files; move logic into focused modules.
- After each slice, run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.
- For Device Setup, Run Wizard, or Run Monitor changes, also run the relevant Mobile MCP preflight/smoke path when runtime services are available.

## Done Criteria

- Touched page files trend below 300 lines where practical.
- Extracted modules have clear names and one responsibility.
- Runtime behavior is verified before marking a refactor complete.

## Unresolved Questions

- Should `DeviceSetupPage` refactor be the first formal Spec Kit feature?
- Is browser UI smoke required for every UI refactor slice or only high-risk slices?

## Progress

- 2026-05-05: Extracted shared Device Setup UI cards/formatters into `src/components/device-setup/`.
  `DeviceSetupPage.tsx` reduced from 1225 to 1075 lines. Static checks and production build pass.
- 2026-05-05: Extracted Device Setup `Guide`, `Protocol`, and `Troubleshoot` tab bodies into
  `src/components/device-setup/device-setup-static-tabs.tsx`. `DeviceSetupPage.tsx` reduced to 889 lines.
  Static checks and production build pass.
- 2026-05-05: Extracted Device Setup hero summary and tab navigation into
  `src/components/device-setup/device-setup-shell.tsx`. `DeviceSetupPage.tsx` reduced to 828 lines.
  Static checks and production build pass.
- 2026-05-05: Extracted Verify tab runtime endpoint/checklist and live probe panels into
  `src/components/device-setup/device-setup-verify-panels.tsx`. `DeviceSetupPage.tsx` reduced to 713 lines.
  Static checks and production build pass.
- 2026-05-05: Extracted operator diagnostics, recovery actions, and selected-device summary into
  `src/components/device-setup/device-setup-diagnostics-panels.tsx`. `DeviceSetupPage.tsx` reduced to 524 lines.
  Static checks and production build pass.
- 2026-05-05: Extracted Device Setup verification checklist construction into
  `src/components/device-setup/device-setup-checklist.ts`. `DeviceSetupPage.tsx` reduced to 452 lines.
  Static checks and production build pass.
- 2026-05-05: Extracted Device Setup verification state, endpoint normalization, probes, reconnect prep,
  lock cleanup, and derived diagnostics into `src/components/device-setup/use-device-setup-verification.ts`.
  `DeviceSetupPage.tsx` reduced to 172 lines. Static checks and production build pass.
- 2026-05-05: Split Device Setup runtime verification services and derived UI state into
  `device-setup-verification-runtime.ts` and `device-setup-derived-state.ts`. The verification hook is now
  197 lines. Static checks and production build pass.
- 2026-05-05: Extracted Device Setup probe result rendering into `device-setup-probe-result-card.tsx`.
  `device-setup-verify-panels.tsx` reduced to 175 lines. Static checks and production build pass.
- 2026-05-05: Extracted selected-device summary and troubleshooting tab into
  `device-setup-selected-device-summary.tsx` and `device-setup-troubleshoot-tab.tsx`.
  All Device Setup page/component files are now below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored `src/components/runs/RunWizard.tsx` into focused macro, target,
  inputs, review, header, footer, navigation, submit, and derived-state modules. `RunWizard.tsx`
  reduced from 746 to 219 lines. Static checks and production build pass.
- 2026-05-05: Extracted run artifact preview cards into `RunArtifactPreviewCard.tsx`.
  `RunArtifactsPanel.tsx` reduced to 177 lines. Static checks and production build pass.
- 2026-05-05: Started `DemoPage.tsx` refactor by extracting demo workflow constants, types,
  status mapping, icon mapping, and duration helper into `components/demo/demo-workflow-state.ts`.
  `DemoPage.tsx` reduced to 584 lines. Static checks and production build pass.
- 2026-05-05: Extracted Demo configuration, step execution, static macro definition, simulated
  runtime helper, seeded macro lookup, progress, and status badge helpers into `components/demo/`.
  `DemoPage.tsx` reduced to 297 lines. Static checks and production build pass.
- 2026-05-05: Refactored Run Monitor into focused data, header, approval, summary, device list,
  status, and runtime helper modules. `RunMonitorPage.tsx` reduced from 573 to 156 lines, and all
  new Run Monitor modules are below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Devices page into focused summary, filters, risk panel, grid/card,
  drawer, battery icon, and shared type modules. `DevicesPage.tsx` reduced from 532 to 170 lines,
  and all new Devices modules are below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored macro guided builder into focused intro, basics, inputs, steps,
  parameter editor, and helper modules. `macro-definition-builder-panel.tsx` reduced from 398 to
  31 lines, and all new macro builder modules are below 200 lines. Static checks and production
  build pass.
- 2026-05-05: Refactored Approvals page into focused audit-focus banner, tabs, list/cards,
  details modal, and shared tab type modules. `ApprovalsPage.tsx` reduced from 348 to 155 lines,
  and all new Approvals modules are below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Run Detail page into focused header, focus banner, progress card,
  run info cards, steps timeline, summary view, status config, and shared stats type modules.
  `RunDetailPage.tsx` reduced from 345 to 133 lines, and all new Run Detail modules are below
  200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Macro Detail page into focused header, about, execution config,
  input schema, step tree, versions list, JSON modal, and shared step/status config modules.
  `MacroDetailPage.tsx` reduced from 335 to 121 lines, and all new Macro Detail modules are
  below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Macros list page into focused header actions, search bar, grid/cards,
  and seed-samples modal modules. `MacrosPage.tsx` reduced from 252 to 103 lines, and all new
  Macros list modules are below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Audit Logs page into focused stats grid, domain chips, filters bar,
  logs list, and shared page type modules. `AuditLogsPage.tsx` reduced from 245 to 135 lines,
  and all new Audit modules are below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Device Groups page into focused grid, create modal, and detail drawer
  modules. `DeviceGroupsPage.tsx` reduced from 225 to 69 lines, and all new Device Groups
  modules are below 200 lines. Static checks and production build pass.
- 2026-05-05: Refactored Runs page into focused summary stats, filters, list, status config,
  and shared page type modules. `RunsPage.tsx` reduced from 213 to 93 lines, and all new Runs
  page modules are below 100 lines. Static checks and production build pass.
- 2026-05-05: Continued Demo page refactor by extracting device loading, live run state, live
  approval polling, and live demo run creation into focused modules. `DemoPage.tsx` reduced from
  297 to 166 lines, and the new Demo modules are below 200 lines. Static checks and production
  build pass.
- 2026-05-05: Extracted Run Wizard form state and target-selection helpers into
  `use-run-wizard-form-state.ts`. `RunWizard.tsx` reduced from 219 to 195 lines, and the new hook
  is below 100 lines. Static checks and production build pass.
- 2026-05-05: Split audit log insight helpers and summary text construction into
  `audit-log-insight-helpers.ts` and `audit-log-summary.ts`. `audit-log-insights.ts` reduced from
  298 to 170 lines while preserving the existing public domain-label export. Static checks and
  production build pass.
- 2026-05-05: Extracted Device Setup lock snapshot summarization into
  `device-setup-lock-summary.ts` while re-exporting the existing API from diagnostics.
  `device-setup-diagnostics.ts` reduced from 214 to 192 lines. Static checks and production
  build pass.
- 2026-05-05: Split Laixi response mapper helpers into `adapters/laixi/response-mappers.ts`
  while re-exporting the existing mapper API for callers. `adapters/laixi/mapper.ts` reduced from
  203 to 141 lines. Static checks and production build pass.
- 2026-05-05: Split sample macro fixture data into `contracts/sample-macros.ts` while keeping
  `SAMPLE_MACROS` re-exported from `contracts/macro.ts` for existing callers. `contracts/macro.ts`
  reduced from 296 to 133 lines. Static checks and production build pass.
- 2026-05-05: Extracted high-level Laixi client actions into `adapters/laixi/client-actions.ts`
  while leaving WebSocket connection and request tracking inside `client.ts`. `adapters/laixi/client.ts`
  reduced from 245 to 186 lines. Static checks and production build pass.
- 2026-05-05: Added `vitest` app test runner scoped to `src`, created focused
  `run-preflight.test.ts` coverage for target mode mapping, missing definitions, role/input
  blocking, template references, sensitive approval gates, and device-lock warnings. Refactored
  `run-preflight.ts` into types, helpers, target issue builders, and step analysis modules.
  `run-preflight.ts` reduced from 398 to 78 lines. Targeted tests, app tests, static checks, and
  production build pass.
- 2026-05-05: Added focused Device Setup helper tests for URL normalization, websocket URL
  conversion, AutoJS bootstrap generation, and protocol example stability. Refactored
  `device-setup.ts` into a facade over typed modules for URL helpers, health fetches, probe
  execution, AutoJS script chunks, and protocol examples. `device-setup.ts` reduced from 507 to
  18 lines, and all Device Setup modules are below 200 lines. App tests, static checks, and
  production build pass.
- 2026-05-05: Added focused `runner.test.ts` coverage for device-lock rejection, continue-on-error,
  retry success, approval rejection, and conditional branch execution. Refactored `runner.ts` into
  `runner-step-flow.ts`, `runner-device-step.ts`, `runner-persistence.ts`, and shared step types.
  `runner.ts` reduced from 426 to 150 lines, all new runner modules are below 200 lines, and
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Added focused `orchestrator.test.ts` coverage for single-device success, mid-run
  cancellation, mixed multi-device aggregation, and `cancelRun()` cleanup. Refactored
  `orchestrator.ts` into focused context, handler, and result modules. `orchestrator.ts` reduced
  from 280 to 133 lines, all runtime orchestration modules are below 200 lines, and
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted shared orchestration test fixtures and workflow-run Supabase mock builder
  into `orchestrator-test-helpers.ts`. `orchestrator.test.ts` was reduced materially while keeping
  the same public API coverage. Full app tests, typecheck, lint, and production build pass.
- 2026-05-05: Split `useRuns.ts` into focused `run-control-requests.ts` and
  `run-query-helpers.ts` modules while preserving the existing hook and request exports from
  `useRuns.ts`. `useRuns.ts` reduced from 182 to 107 lines. Full app tests, typecheck, lint,
  and production build pass.
- 2026-05-05: Split `ApprovalDialog.tsx` into focused `approval-dialog-actions.tsx` and
  `use-approval-dialog-actions.ts` modules while preserving the same modal contract for callers.
  `ApprovalDialog.tsx` reduced from 188 to 84 lines. Full app tests, typecheck, lint, and
  production build pass.
- 2026-05-05: Extracted `RunWizard` data loading and derived-state wiring into
  `use-run-wizard-data.ts`, leaving `RunWizard.tsx` as a thinner shell over existing step
  components and submit flow. `RunWizard.tsx` reduced from 181 to 170 lines. Full app tests,
  typecheck, lint, and production build pass.
- 2026-05-05: Extracted Run Wizard macro filtering, input-field derivation, target-device
  resolution, dispatchable-device filtering, and fleet counters into
  `src/components/runs/run-wizard-derived-helpers.ts`. `use-run-wizard-derived-state.ts` now
  stays at 169 lines, the new helper stays at 104 lines, and `npm.cmd test`, `npm.cmd run
  typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted Demo configuration live-device selection and mode/role notices into
  `src/components/demo/demo-configuration-sections.tsx`. `DemoConfigurationPanel.tsx` dropped
  from 192 to 130 lines, the new section module stays at 121 lines, and `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted runner conditional/approval control flow into
  `src/engine/runner-control-flow.ts` while keeping `runStepsWithFlow()` and group execution in
  `runner-step-flow.ts`. `runner-step-flow.ts` dropped from 202 to 132 lines, the new helper is
  85 lines, and `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` pass.
- 2026-05-05: Extracted approval status/config parsing and requested-action derivation into
  `src/lib/approval-insight-helpers.ts` while preserving `buildApprovalInsight()` as the stable
  public entry point. `approval-insights.ts` dropped from 190 to 50 lines, the new helper is
  152 lines, and `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` pass.
- 2026-05-05: Extracted Device Setup probe execution, reconnect preparation, and expired-lock
  cleanup handlers into `src/components/device-setup/use-device-setup-verification-actions.ts`
  while preserving the existing `useDeviceSetupVerification()` return shape for `DeviceSetupPage`.
  `use-device-setup-verification.ts` dropped from 197 to 143 lines, the new action hook is
  144 lines, and `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` pass.
- 2026-05-05: Extracted macro authoring mode toggle, JSON editor, validation errors, and footer
  actions into `src/components/macros/macro-definition-authoring-sections.tsx` while preserving
  the same modal submit and mode-switch behavior. `macro-definition-authoring-modal.tsx` dropped
  from 190 to 166 lines, the new section module is 111 lines, and `npm.cmd test`, `npm.cmd run
  typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted guided macro step-card editing controls into
  `src/components/macros/macro-builder-step-card.tsx` while preserving the same builder step list
  update contract. `MacroBuilderStepsSection.tsx` dropped from 189 to 95 lines, the new step
  card module is 143 lines, and `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
  and `npm.cmd run build` pass.
- 2026-05-05: Split macro fetchers and mutation request bodies into
  `src/hooks/macro-query-helpers.ts` and `src/hooks/macro-mutation-requests.ts` while preserving
  the existing `useMacros`, `useMacro`, `useMacroVersions`, `useCreateMacro`,
  `useCreateMacroVersion`, and `useActivateMacroVersion` exports for callers. `useMacros.ts`
  dropped from 183 to 69 lines, the new helper modules are 40 and 112 lines, and `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted Run Wizard step-content switching into
  `src/components/runs/run-wizard-step-content.tsx` and step navigation state into
  `src/components/runs/use-run-wizard-navigation-state.ts` while preserving the same wizard submit
  flow, footer actions, and page integration. `RunWizard.tsx` dropped from 184 to 163 lines, the
  new helper modules are 138 and 48 lines, and `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted Device Setup operator diagnostics and recovery panels into
  `src/components/device-setup/device-setup-operator-diagnostics-panel.tsx` and
  `src/components/device-setup/device-setup-recovery-actions-panel.tsx`, leaving
  `device-setup-diagnostics-panels.tsx` as a 3-line re-export surface for `DeviceSetupPage`.
  The new panel modules are 75 and 109 lines, and `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted Run Evidence stats, per-step evidence blocks, and unlinked artifact
  rendering into `src/components/runs/run-artifacts-sections.tsx` while preserving the same
  `RunArtifactsPanel` props for `RunDetailPage`. `RunArtifactsPanel.tsx` dropped from 177 to
  83 lines, the new section module is 143 lines, and `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted audit log row action/resource config and expanded detail rendering into
  `src/components/audit/audit-log-row-config.ts` and `src/components/audit/audit-log-row-details.tsx`,
  reducing `AuditLogRow.tsx` from 166 to 77 lines while preserving the existing `AuditLogsList`
  row props and toggle behavior. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
  and `npm.cmd run build` pass.
- 2026-05-05: Extracted run wizard review summary card and preflight panel rendering into
  `src/components/runs/run-wizard-review-sections.tsx`, reducing `RunWizardReviewStep.tsx`
  from 167 to 54 lines while preserving the existing review-step props and wizard dispatch
  readiness behavior. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` pass.
- 2026-05-05: Extracted approval card, actions, and status styling into
  `src/components/approvals/approvals-list-sections.tsx`, reducing `ApprovalsList.tsx`
  from 164 to 69 lines while preserving the existing list props and approval action behavior.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted run monitor device and step cards into
  `src/components/runs/run-monitor-device-sections.tsx`, reducing `RunMonitorDeviceList.tsx`
  from 164 to 25 lines while preserving the existing monitor list props and expand/collapse
  toggle behavior. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` pass.
- 2026-05-05: Extracted approval details content, facts, metadata, and reject form into
  `src/components/approvals/approval-details-sections.tsx`, reducing
  `ApprovalDetailsModal.tsx` from 162 to 51 lines while preserving the existing modal props and
  approval resolution behavior. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
  and `npm.cmd run build` pass.
- 2026-05-05: Extracted run wizard target mode grid, contract notice, device picker, group
  picker, and all-devices summary into `src/components/runs/run-wizard-target-sections.tsx`,
  reducing `RunWizardTargetStep.tsx` from 161 to 73 lines while preserving the existing wizard
  target props and selection behavior. The new target sections module is 194 lines.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted guided builder step catalog into `src/lib/macro-builder-config.ts` and
  deep-clone, ID generation, template lookup, and compatibility scanning helpers into
  `src/lib/macro-builder-helpers.ts`, reducing `macro-builder.ts` from 160 to 72 lines while
  preserving the existing guided builder exports and behavior. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted social DSL slugging, target-param mapping, and step compilation helpers
  into `src/contracts/social-macro-dsl-helpers.ts`, reducing `social-macro-dsl.ts` from 160 to
  108 lines while preserving the existing social DSL exports and compile behavior. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted wizard target mode option rendering into
  `src/components/runs/run-wizard-target-mode-card.tsx`, reducing
  `run-wizard-target-sections.tsx` from 194 to 177 lines while preserving the existing wizard
  target props and selection behavior. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted approval fetch/update/requeue/cancel helpers into
  `src/lib/approval-service-helpers.ts`, reducing `approval-service.ts` from 159 to 115 lines
  while preserving the existing approval service exports and decision behavior. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted review metrics and preflight issue-card primitives into
  `src/components/runs/run-wizard-review-primitives.tsx`, reducing
  `run-wizard-review-sections.tsx` from 174 to 141 lines while preserving the existing
  review-step summary and preflight panel behavior. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted macro target contract and all-devices fleet notices into
  `src/components/runs/run-wizard-target-notices.tsx`, reducing
  `run-wizard-target-sections.tsx` from 187 to 132 lines while preserving the existing wizard
  target-mode selection and fleet summary behavior. A first typecheck caught stale imports in
  `RunWizardTargetStep.tsx`; after fixing the wiring, `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted shared run-inputs, aggregate summary, and execution-result factories into
  `src/engine/orchestrator-test-helpers.ts`, reducing `orchestrator.test.ts` from 217 to
  186 lines while preserving the same cancellation, multi-device summary, and workflow-status
  assertions. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` pass.
- 2026-05-05: Extracted Device Setup diagnostic types and grouped issue builders into
  `src/lib/device-setup-diagnostic-types.ts` and
  `src/lib/device-setup-diagnostic-builders.ts`, reducing `device-setup-diagnostics.ts`
  from 192 to 39 lines while preserving `buildDeviceSetupDiagnostics()` as the stable public
  entry point. The first verify pass caught unused type imports in the new facade; after
  removing them, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-05: Extracted runner device fixture, execution-context factory, and harness spy setup
  into `src/engine/runner-test-helpers.ts`, reducing `runner.test.ts` from 191 to 138 lines
  while preserving the same lock, retry, approval, and conditional-flow assertions. The first
  verify pass caught one leftover `createContext()` call and then a helper return type that was
  too broad for `executeForDevice()` typing; after fixing both, `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Laixi transport defaults, listener/request types, socket-ready check,
  request-id generation, and response mapping into
  `src/adapters/laixi/client-transport-helpers.ts`, reducing `client.ts` from 186 to 185 lines
  while preserving the existing `LaixiClient` API and reconnect/request behavior.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted runner step retry timing, exception classification, and failed-step
  finalization into `src/engine/runner-device-step-helpers.ts`, reducing
  `runner-device-step.ts` from 183 to 158 lines while preserving the existing device-step
  execution contract and failure artifact behavior. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted service health, device availability, and probe issue cohorts into
  `src/lib/device-setup-diagnostic-cohorts.ts`, reducing
  `device-setup-diagnostic-builders.ts` from 190 to 77 lines while preserving
  `buildDeviceSetupDiagnostics()` and the existing severity/order behavior. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted orchestration test reset helpers, secondary-device fixture, partial-run
  summaries, and workflow status assertion helpers into `src/engine/orchestrator-test-helpers.ts`,
  reducing `orchestrator.test.ts` from 186 to 171 lines. This shifted the largest test-helper
  surface up to 191 lines, which is recorded explicitly rather than hidden. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Split orchestration test support helpers out of
  `src/engine/orchestrator-test-helpers.ts` into `src/engine/orchestrator-test-support.ts`,
  reducing the helper surface from 191 to 141 lines while preserving the same reset and
  workflow-status assertion behavior for `orchestrator.test.ts`. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted device live-probe selector and action buttons into
  `src/components/device-setup/device-setup-live-probe-controls.tsx`, reducing
  `device-setup-verify-panels.tsx` from 175 to 152 lines while preserving the same selected-device
  and probe-trigger behavior. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
  and `npm.cmd run build` pass.
- 2026-05-05: Expanded `src/adapters/laixi/client-transport-helpers.ts` with websocket lifecycle
  binding, JSON message parsing, pending-request resolution, and shared failure responses,
  reducing `client.ts` from 185 to 170 lines while preserving the existing `LaixiClient`
  API and reconnect/request behavior. The first verify pass caught one unused import; after
  removing it, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup verify-tab composition into
  `src/components/device-setup/device-setup-verify-tab.tsx`, reducing `DeviceSetupPage.tsx`
  from 172 to 132 lines while preserving the same verification hook wiring, selected-device
  state, and recovery/probe behavior. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Moved Run Wizard macro/version selection, declared target derivation, and preflight
  argument assembly into `src/components/runs/run-wizard-derived-helpers.ts`, reducing
  `use-run-wizard-derived-state.ts` from 167 to 157 lines while preserving the same wizard
  derived-state contract for `RunWizard`. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Split Run Wizard selection and preflight assembly into
  `src/components/runs/run-wizard-preflight-helpers.ts`, reducing
  `run-wizard-derived-helpers.ts` from 168 to 93 lines while preserving the same target-device,
  fleet-count, and preflight behavior for `use-run-wizard-derived-state.ts`. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted approval facts and metadata rendering into
  `src/components/approvals/approval-details-facts.tsx`, reducing
  `approval-details-sections.tsx` from 155 to 124 lines while preserving the same approval
  modal summary, role-access notice, and reject/approve behavior. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Collapsed Run Wizard target-device counters and lock-derived lists into
  `buildRunWizardTargetState()` inside `src/components/runs/run-wizard-derived-helpers.ts`,
  reducing `use-run-wizard-derived-state.ts` from 159 to 146 lines while preserving the same
  derived-state contract and preflight inputs for `RunWizard`. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted Devices page card-model mapping, filter logic, summary cohorts, and
  dispatch-risk list derivation into `src/components/devices/devices-page-helpers.ts`,
  reducing `DevicesPage.tsx` from 155 to 142 lines while preserving the same sync flow,
  device drawer selection, summary drilldown, and risk panel behavior. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` pass.
- 2026-05-05: Extracted Run Wizard modal frame into `RunWizardModalLayout.tsx` and submit
  wiring into `use-run-wizard-submit-action.ts`, reducing `RunWizard.tsx` from 154 to
  149 lines while preserving the same step-content props, footer behavior, navigation, and run
  dispatch flow. The first verify pass caught one remaining `profile?.role` reference after the
  submit hook split; after switching that to a dedicated `profileRole` selector, `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup stat/check/recovery primitives into
  `src/components/device-setup/device-setup-card-primitives.tsx`, reducing
  `device-setup-cards.tsx` from 154 to 84 lines while preserving the same import surface through
  re-exports for the existing Device Setup panels. The first verify pass caught one unused
  `ReactNode` import left behind in `device-setup-cards.tsx`; after removing it, `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup checklist tone and detail helpers into
  `src/components/device-setup/device-setup-checklist-helpers.ts`, reducing
  `device-setup-checklist.ts` to 142 lines while preserving the existing verification checklist
  titles, statuses, and probe guidance. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Run Monitor step detail rendering into
  `src/components/runs/run-monitor-step-details.tsx`, reducing
  `run-monitor-device-sections.tsx` from 161 to 120 lines while preserving the existing
  expand/collapse behavior, raw input/output blocks, error panel, and screenshot preview.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup guide support panels and protocol support panels into
  `src/components/device-setup/device-setup-static-tab-panels.tsx`, reducing
  `device-setup-static-tabs.tsx` from 158 to 111 lines while preserving the existing AutoJS
  bootstrap, environment reference, websocket contract, runtime expectation, and local runtime
  content. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`
  all pass.
- 2026-05-05: Extracted Run Monitor device status aggregation into
  `src/components/runs/run-monitor-device-status-helpers.ts`, reducing
  `use-run-monitor-data.ts` from 158 to 109 lines while preserving the existing run fetch,
  pending-approval polling, realtime subscription, and per-device monitor status contract.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted audit log insight types plus highlight and related-link builders into
  `src/lib/audit-log-insight-types.ts` and `src/lib/audit-log-insight-sections.ts`, reducing
  `audit-log-insights.ts` from 170 to 59 lines while preserving `buildAuditLogInsight()`,
  `getAuditDomainLabel()`, and `AUDIT_DOMAIN_ORDER` as the stable public entrypoints. The first
  verify pass caught one unused import after the split; after removing it, `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted macro authoring modal state, template application, mode switching, JSON
  parsing, and submit validation into `src/components/macros/use-macro-definition-authoring-state.ts`,
  reducing `macro-definition-authoring-modal.tsx` from 166 to 87 lines while preserving the
  existing modal layout, starter-template picker, builder/JSON toggle, and `onSubmit` contract.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted device drawer facts and raw metadata panels into
  `src/components/devices/device-drawer-detail-sections.tsx`, reducing
  `DeviceDrawer.tsx` from 154 to 103 lines while preserving the existing drawer shell, device
  identity summary, battery card, lock-state display, and metadata rendering. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted runtime endpoint inputs and live probe result rendering into
  `src/components/device-setup/device-setup-verify-sections.tsx`, reducing
  `device-setup-verify-panels.tsx` from 152 to 128 lines while preserving the existing endpoint
  editing, checklist display, selected-device probe controls, and current-app/screenshot result
  cards. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`
  all pass.
- 2026-05-05: Extracted approval requested-action parsing and metadata selection into
  `src/lib/approval-requested-action.ts`, reducing `approval-insight-helpers.ts` from 152 to
  101 lines while preserving the existing approval status labels, step config mapping,
  requested-action summary, and resolved-outcome text. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Run Wizard selection, target-device derivation, lock snapshot building,
  target-state aggregation, and preflight memo wiring into
  `src/components/runs/use-run-wizard-target-derivations.ts`, reducing
  `use-run-wizard-derived-state.ts` from 148 to 104 lines while preserving the existing
  `useRunWizardDerivedState()` return contract for `RunWizard`. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup probe, reconnect, and expired-lock cleanup async flows into
  `src/components/device-setup/device-setup-action-helpers.ts`, reducing
  `use-device-setup-verification-actions.ts` from 144 to 104 lines while preserving the existing
  hook return contract, toast messaging, selected-device probe behavior, and post-action
  verification refresh. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-05: Extracted live demo macro lookup, workflow-run creation, audit logging, and dispatch
  request flow into `src/components/demo/demo-live-run-request.ts`, reducing `demo-runtime.ts`
  from 143 to 84 lines while preserving the existing simulated demo timing, live demo launch
  behavior, and `runLiveDemo()` / `runSimulatedDemo()` contracts used by `DemoPage`.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Demo page run/reset orchestration into
  `src/components/demo/use-demo-run-controller.ts`, reducing `DemoPage.tsx` from 166 to
  127 lines while preserving the existing simulated/live mode behavior, active run cancellation,
  step reset timing, and panel wiring. `npm.cmd test`, `npm.cmd run typecheck`,
  `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Split Device Setup verification snapshot fetching and probe-selection helpers into
  `src/components/device-setup/device-setup-verification-snapshot.ts` and
  `src/components/device-setup/device-setup-verification-probe-helpers.ts`, reducing
  `device-setup-verification-runtime.ts` from 143 to 21 lines while preserving the existing
  verification fetch, selected-device fallback, live probe dispatch, and lock cleanup exports.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup runtime endpoint state, normalized URL derivation, gateway
  websocket URL construction, and AutoJS bootstrap generation into
  `src/components/device-setup/use-device-setup-runtime-config.ts`, reducing
  `use-device-setup-verification.ts` from 143 to 126 lines while preserving the existing hook
  return contract, verification refresh flow, selected-device fallback, and action wiring.
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted Device Setup runtime and probe checklist item builders into
  `src/components/device-setup/device-setup-checklist-items.ts`, reducing
  `device-setup-checklist.ts` from 142 to 65 lines while preserving the existing checklist item
  titles, tones, persistence guidance, and probe-detail copy. The first verify pass caught a
  missing `DeviceSetupChecklistItem` re-export on the facade; after restoring that export,
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-05: Extracted run-artifact step evidence and unlinked artifact rendering into
  `src/components/runs/run-artifacts-evidence-sections.tsx`, reducing
  `run-artifacts-sections.tsx` from 143 to 67 lines while preserving the existing `RunArtifactsPanel`
  section exports, audit-focus badge behavior, per-step artifact grouping display, and unlinked
  artifact messaging. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-06: Extracted Device Setup live-probe checklist item builders into
  `src/components/device-setup/device-setup-probe-checklist-items.ts`, reducing
  `device-setup-checklist-items.ts` from 146 to 113 lines while preserving the existing
  `buildDeviceSetupProbeChecklistItems()` export surface, probe tone mapping, and user-facing
  current-app/screenshot guidance. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
  and `npm.cmd run build` all pass.
- 2026-05-06: Extracted Run Wizard review device chips and populated input-variable sections into
  `src/components/runs/run-wizard-review-detail-sections.tsx`, reducing
  `run-wizard-review-sections.tsx` from 141 to 117 lines while preserving the existing review
  summary metrics, device health/lock badges, input-variable display, and preflight pass/fail
  panel behavior. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-06: Extracted Macro Builder step-card header controls and policy controls into
  `src/components/macros/macro-builder-step-card-sections.tsx`, reducing
  `macro-builder-step-card.tsx` from 143 to 39 lines while preserving the existing step ID/type
  editing, move/remove actions, guided-params editor wiring, approval toggle, and timeout/retry
  policy updates. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-06: Extracted orchestrator test async/mock builders into
  `src/engine/orchestrator-test-mock-builders.ts`, reducing
  `orchestrator-test-helpers.ts` from 141 to 104 lines while preserving the existing
  `deferred()` and `createWorkflowRunsSupabaseMock()` import surface through re-exports for
  `orchestrator.test.ts`. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-06: Extracted Device Setup tab-content rendering into
  `src/components/device-setup/device-setup-page-tab-content.tsx`, reducing
  `DeviceSetupPage.tsx` from 141 to 123 lines while preserving the existing page shell,
  verification hook wiring, and verify/guide/protocol/troubleshoot tab behavior. The first
  typecheck pass caught a mismatched `DeviceLockSnapshot` import and selected-lock prop typing in
  the new tab-content component; after aligning those props with `DeviceSetupVerifyTab`,
  `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-06: Extracted Laixi command-backed step execution handlers into
  `src/adapters/laixi/step-execution-helpers.ts`, reducing `mapper.ts` from 141 to 80 lines
  while preserving `executeStepOnDevice()` as the stable dispatch entrypoint and leaving the
  response-mapper exports untouched. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`,
  and `npm.cmd run build` all pass.
- 2026-05-06: Extracted Laixi tap/swipe batch-command handlers into
  `src/adapters/laixi/step-execution-batch-helpers.ts`, reducing
  `step-execution-helpers.ts` from 160 to 117 lines while preserving the existing
  `executeTapStep()` and `executeSwipeStep()` export surface through re-exports for `mapper.ts`.
  The first typecheck pass caught two unused imports left behind in `step-execution-helpers.ts`;
  after removing them, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-06: Extracted Devices page header sync action and device-lock warning into
  `src/components/devices/devices-page-shell-sections.tsx`, reducing `DevicesPage.tsx`
  from 142 to 141 lines while preserving the existing sync flow, toast behavior,
  summary drilldown, filtered grid, and drawer selection. `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` all pass.
- 2026-05-06: Extracted Run Monitor loading/not-found shell states and progress aggregation into
  `src/components/runs/run-monitor-page-shell.tsx` and
  `src/components/runs/run-monitor-progress.ts`, reducing `RunMonitorPage.tsx`
  from 142 to 127 lines while preserving the existing polling, cancel flow,
  approval modal wiring, auto-refresh toggle, and per-device expansion behavior.
  The first typecheck pass caught a wrong `RunStep` import source, and the first
  lint pass flagged a non-component export in the shell file; after correcting
  both issues, `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, and
  `npm.cmd run build` all pass.
- 2026-05-06: Extracted runner failure-screenshot capture and lock-renewal helpers into
  `src/engine/runner-failure-screenshot.ts` and `src/engine/runner-lock-renewal.ts`,
  reducing `runner.ts` from 150 to 128 lines while preserving the existing
  `WorkflowRunner` class contract for runner tests, lock acquisition/release flow,
  retry/approval execution path, and persisted failure screenshot behavior. The
  first test pass exposed that `runner.test.ts` spies on `startLockRenewal`,
  `stopLockRenewal`, and `captureFailureScreenshot`, so those methods were kept
  as thin wrappers over the new helpers before rerunning `npm.cmd test`,
  `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` to green.
