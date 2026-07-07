# Frontend (UI/State) Review

**Date:** 2026-06-30
**Scope:** `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`

## Findings

### React Anti-Patterns & Optimization
1. **Missing `useCallback`/`useMemo` in list items:** Deeply nested lists (like logs or run steps) often rely on inline arrow functions for callbacks, causing unnecessary re-renders of children on every state update. `ApprovalsPage.tsx`, `AccountsPage.tsx`.
2. **God Components:** Some components (e.g., `RunWizard.tsx`, `fleet-health-page.tsx`) house too much business logic inline, making them hard to test. Hooks like `use-run-wizard-form-state` exist but `RunWizard` still manages vast DOM output.
3. **Over-fetching in React Query:** `use-accounts.ts` and `useAccounts.ts` define similar hooks leading to duplicate/split queries.
4. **Zustand store lifetimes:** `useUIStore` is a module singleton. Toasts accumulate and mutate the global store array without strict component lifecycle binding.

### State Management Hygiene
1. **Duplicate hooks files:** `use-accounts.ts` and `useAccounts.ts` exist. Same for `use-runs.ts`/`useRuns.ts`. Mixed naming convention (kebab vs camelCase).
2. **Global queries without error boundaries:** `App.tsx` has `<ErrorBoundary>` around `<BrowserRouter>`, but inner route failures don't have nested boundaries to prevent full app crashes on isolated component errors.
3. **Props drilling:** Deeply nested components in the wizard/monitoring pass 5+ props down multiple levels.

### Component Boundaries
1. **Huge files:** Many files in `pages/` exceed 300-500 lines due to inline data transformations and UI rendering together.
2. **Missing index exports:** Components are imported via deep paths (`../components/accounts/warmup-progression-panel`) instead of index barrels (`../components/accounts`).

## Conclusion
Frontend is functional but suffers from Tech Debt around naming conventions, split React Query hooks, and missing nested Error Boundaries.
