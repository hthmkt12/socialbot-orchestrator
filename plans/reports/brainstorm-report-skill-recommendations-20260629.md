# Brainstorm Report: Agent Skill Recommendations for Social Pivot (Phase 0 & 1)

**Date:** 2026-06-29
**Status:** Approved
**Strategy:** Parallel Planning + Playbook Orchestration

---

## 1. Context & Requirements

**Current State:** The project is pivoting to a Social Media Automation Platform. Phase 0 (Foundation: docs, schema) and Phase 1 (MVP: anti-detection, account lifecycle) are the immediate next steps.
**Expected Output:** A report mapping specific skills to upcoming roadmap tasks.
**Scope:** Phase 0 and Phase 1 only.
**Acceptance Criteria:** Specific skill names, exact commands, and trade-offs/rationale.

---

## 2. Recommended Skill Strategy: Parallel Planning + Playbook Orchestration

This strategy leverages advanced orchestration skills to handle the complexity of the anti-detection engine and account lifecycle management concurrently.

### Phase 0: Foundation (Docs & Schema)

The goal here is to establish the base layer (database tables and updated documentation) before building the logic.

*   **Task 0.1: Database Schema Generation**
    *   **Skill:** `ckm:databases` (or standard planning if complex migrations are needed).
    *   **Command:** `/ckm:plan Create Supabase migrations for accounts and account_action_history tables as defined in social-first-roadmap`
    *   **Rationale:** Standard planning handles Supabase migrations well. `ckm:databases` is good if starting from scratch, but since Supabase is in use, generating migration files via a plan is safer.
*   **Task 0.2: Documentation Updates**
    *   **Skill:** `ckm:docs:update`
    *   **Command:** `/ckm:docs:update Update README and onboarding copy to reflect social media automation pivot based on brainstorm-report-social-first-roadmap.md`
    *   **Rationale:** Automates the tedious process of ensuring all docs align with the new strategic direction.

### Phase 1: Anti-Detection & Account Lifecycle (MVP)

This phase involves complex, intertwined systems.

*   **Task 1.1: Deep Context Gathering (Prerequisite)**
    *   **Skill:** `scout` (or `ckm:scout`)
    *   **Command:** `/scout Find all files related to macro step execution and device bridging to prepare for anti-detection injection`
    *   **Rationale:** Before injecting random delays and scroll variance, you *must* know exactly where the step execution happens in the backend/bridge.
*   **Task 1.2: Parallel Planning for Core Features**
    *   **Skill:** `ckm:plan:parallel`
    *   **Command:** `/ckm:plan:parallel Plan the implementation of Phase 1: Anti-detection engine (delays, variance) AND Account Lifecycle (state tracking, query hooks) so they can be executed concurrently`
    *   **Rationale:** Anti-detection (Python/Node backend) and Account Lifecycle (React Query/Supabase) touch completely different parts of the stack. Parallel planning isolates these concerns.
*   **Task 1.3: Orchestrated Execution**
    *   **Skill:** `ckm:play`
    *   **Command:** `/ckm:play:create Create a playbook to execute the Phase 1 parallel plan` (followed by `/ckm:play:next`)
    *   **Rationale:** A playbook acts as a state machine, ensuring the DB hooks are ready before the UI uses them, and the backend engine is ready before the macro steps rely on it. It manages the dependencies between the parallel phases.
*   **Task 1.4: Security & Risk Assessment**
    *   **Skill:** `ck-security` (or `ck-predict`)
    *   **Command:** `/ck-predict Debate the risks of the anti-detection implementation specifically regarding Instagram ToS and platform fingerprinting`
    *   **Rationale:** The roadmap explicitly calls out legal/ToS risks for social automation. Using a predictive or security skill helps identify edge cases (e.g., identifiable user-agents) before writing the code.

---

## 3. Trade-offs Evaluated

| Approach | Pros | Cons | Why Recommended / Rejected |
| :--- | :--- | :--- | :--- |
| **Parallel Planning + Playbook (Recommended)** | Fastest time-to-market; isolates backend (anti-detect) from frontend (accounts); structured execution. | High cognitive load initially; requires strict boundary definitions. | Phase 1 features touch completely different stacks (Python/Node vs React/DB). Parallel execution is ideal here. |
| **Sequential Focused Planning** | Lower cognitive load; easier to rollback single features; safer. | Slower execution; bottlenecks (e.g., UI waiting for DB). | Rejected because it serializes work that has no technical dependency. |
| **Risk-First (Brainstorm -> Schema -> Plan)** | Solves the hardest problem (anti-detect architecture) first. | Delays UI and schema work unnecessarily. | The roadmap already outlines the anti-detect requirements; we need execution speed now, not more brainstorming. |

---

## 4. Next Steps

1.  Execute the Phase 0 schema creation: `/ckm:plan Create Supabase migrations for accounts and account_action_history tables`
2.  Execute the Phase 0 doc updates: `/ckm:docs:update Update README...`
3.  Once Phase 0 is merged, initiate Phase 1 planning: `/ckm:plan:parallel Plan the implementation of Phase 1...`
