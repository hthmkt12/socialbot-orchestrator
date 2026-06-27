# Phase 11: Playwright E2E Testing Suite

## Context
With the core application stabilized across devices, workflows, analytics, and documentation, it's crucial to implement an end-to-end testing suite. Manual QA does not scale as the platform grows. Playwright will serve as the testing framework to ensure UI routing, component rendering, and basic user flows remain intact.

## Goals
1. Install and configure Playwright in the project.
2. Write foundational E2E test suites for:
   - Navigation & Sidebar rendering.
   - Social Dashboard & Analytics view checks.
   - Docs Page markdown rendering.
3. Configure `npm run test:e2e` for easy CI/CD integration.

## Files to Create / Modify
| File | Action |
|------|--------|
| `playwright.config.ts` | Initialize config |
| `package.json` | Add test scripts and dependencies |
| `tests/e2e/navigation.spec.ts` | Test sidebar and routing |
| `tests/e2e/docs.spec.ts` | Test documentation rendering |

## Approach
- Install `@playwright/test`.
- Create a `playwright.config.ts` targeting a local dev server (port 5173).
- Write basic tests asserting standard DOM elements are visible on the dashboard and docs pages without requiring deep database mocking initially (testing structural stability).

## Verification
- Run `npm run test:e2e`.
- Verify tests pass headless execution without hanging or crashing.
