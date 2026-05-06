# Specify Workflow

Date: 2026-05-05

## Status
Spec Kit is bootstrapped locally for this project.

Created/restored:
- `.claude/commands/constitution.md`
- `.claude/commands/specify.md`
- `.claude/commands/plan.md`
- `.claude/commands/tasks.md`
- `.claude/commands/implement.md`
- `scripts/powershell/*.ps1`
- `scripts/bash/*.sh`
- `templates/*.md`

The app root is now a git repo so Spec Kit scripts can resolve repo root.

Local script compatibility fixes were applied because this project started as a
no-commit repo:
- `scripts/powershell/common.ps1` uses `git branch --show-current`.
- `scripts/bash/common.sh` uses `git branch --show-current`.
- `Test-FeatureBranch` now fails cleanly on non-numbered branches.

## Tooling
- `speckit --version`: `0.1.0`
- Installed package path: `C:\Users\manhpc\AppData\Roaming\npm\node_modules\@letuscode\spec-kit`
- `speckit check` passes required local tools used here: git, claude, gemini, opencode, codex-cli, copilot.
- `speckit check` still reports missing optional tools: cursor-agent, qwen, windsurf.

## Command Flow
1. `/constitution`
2. `/specify <feature description>`
3. `/plan`
4. `/tasks`
5. `/implement`

Before treating `/plan` output as ready, follow `.claude/rules/plan-verification-rules.md`: re-grep factual claims, cite symbols with `file:line`, audit state lifetimes, enumerate callers for signature changes, and run a fresh audit pass.

PowerShell scripts are the primary Windows path:
- `scripts/powershell/create-new-feature.ps1`
- `scripts/powershell/setup-plan.ps1`
- `scripts/powershell/check-task-prerequisites.ps1`
- `scripts/powershell/check-implementation-prerequisites.ps1`

## Current Caveat
No feature spec has been created yet. Running `/specify` will create a numbered feature branch and `specs/<branch>/spec.md`.

Baseline commits now exist, so the next `/specify` can start from `master` once the first feature is selected.

Verification:
- expected Spec Kit paths exist
- PowerShell scripts parse clean
- `get-feature-paths.ps1` now correctly rejects `master` because it is not a numbered feature branch
- `npm.cmd run typecheck` passes

## Recommended First Spec
Use the first real spec for one of:
- `persist mobile mcp pilot runner environment`
- `normalize pilot artifact storage`
- `split device setup page into maintainable panels`

## Unresolved Questions
- Should future hard plans live under `specs/` instead of `plans/`?
