# Docs & Refactoring Plan

## Context
The "Next" section of the roadmap calls for two items we can address now:
1. Normalize docs/spec workflow around `specs/` for new work.
2. Modularize oversized UI files after runtime proof remains stable.

We just modularized `social-dashboard-page.tsx`. Now let's tackle `fleet-health-page.tsx` which is 229 lines, and check for any remaining spec cleanup.

## Scope
1. **Modularize `fleet-health-page.tsx`**
   - Extract `DeviceMetricCard.tsx`
   - Extract `DeviceGridCard.tsx`
2. **Modularize `DevicesPage.tsx`**
   - It's 155 lines, can extract `DeviceCard.tsx` or similar if applicable.
3. **Docs Normalization**
   - Ensure the `/docs` directory is for reference, architecture, and project rules.
   - Ensure the `/specs` directory is the standard location for new feature requirements.
