# Brainstorm Report: Ghost Features Use Case Alignment

- **Date:** 2026-07-10
- **Author:** Antigravity (Orchestrator Droid)
- **Status:** Approved & Implemented
- **Project:** SocialBot Orchestrator

## 1. Problem Statement
The codebase contains 5 "Ghost" features/pages (Device Setup, Schedules, Analytics, Admin Execution Profiles, Device Groups) that were fully functional but lacked representation in the system's core requirements document (`docs/use-cases.md`). This led to an incomplete project "health" alignment and high regression risk.

## 2. Decision & Alignment Strategy
To bring alignment, we evaluated 3 options:
- **Option 1 (Approved):** Fully specify Use Cases matching the existing implementation. This ensures all existing code is cataloged, tested, and guarded against future code changes.
- **Option 2:** Delete all Ghost code (Strict YAGNI). Rejected because the features are functional and highly valuable for fleet operations.
- **Option 3:** Move them to Out of Scope. Rejected because they are currently accessible via sidebar and main app layouts.

## 3. Implemented Use Cases
We mapped the behavior of the 5 features across all roles and integrated them directly into `docs/use-cases.md` under:
- **Viewer:** Read-only access to Device Setup summaries, Schedules, Analytics, and Device Groups.
- **Operator:** Diagnostics control (test live probes, clean expired locks), CRUD workflow schedules, analytics data tracking, and group membership changes.
- **Admin:** Configuration profiles editing (retry/backoff, target failure policies), force clearing active locks, and managing users/roles.

## 4. Verification & Validation
- **Unit/Integration Tests:** 338/338 passed.
- **Lint & Typecheck:** Clean (0 errors).
- **Enforcement:** Updated matrices show all features now properly integrated with role-based policies.
