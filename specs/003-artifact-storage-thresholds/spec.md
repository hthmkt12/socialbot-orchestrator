# Feature Specification: Artifact Storage Thresholds

**Feature Branch**: `003-artifact-storage-thresholds`<br>
**Created**: 2026-05-06<br>
**Status**: Draft<br>
**Input**: Roadmap item: "Decide numeric artifact storage thresholds before larger screenshot volume, longer retention, or external sharing"

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a pilot maintainer, I need explicit artifact storage thresholds so the team knows when inline artifact rows are still acceptable and when the product must move screenshots/logs/JSON evidence to object storage.

### Acceptance Scenarios

1. **Given** a pilot run emits small screenshot/log/JSON evidence, **When** maintainers review the storage policy, **Then** inline `artifacts` rows remain acceptable and are not treated as a blocker.
2. **Given** screenshots or logs exceed documented size, count, retention, or sharing thresholds, **When** maintainers review the policy, **Then** object storage becomes a required feature before scaling that workload.
3. **Given** an artifact is too large for inline UI preview, **When** operators view run evidence, **Then** the threshold policy explains why preview is omitted and what future object-storage work must preserve.
4. **Given** future work proposes high-volume runs, longer retention, or external evidence sharing, **When** the roadmap is updated, **Then** the threshold policy provides measurable triggers instead of vague "later" language.

### Edge Cases

- A single screenshot is below the UI preview limit but many screenshots per run create database bloat.
- A JSON result is small but contains bulky nested payloads that make inline preview noisy.
- Retention needs change before screenshot volume changes.
- External sharing is required for a small number of artifacts.
- Historical inline artifacts still need readable metadata after object storage is introduced.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The policy MUST state the current inline pilot default for screenshot, text-log, and JSON result previews.
- **FR-002**: The policy MUST define numeric thresholds for single-artifact inline preview size, artifacts per run, screenshots per run, and retention duration.
- **FR-003**: The policy MUST define non-numeric triggers for object storage, including external sharing, durable audit export, and artifact access outside authenticated run detail views.
- **FR-004**: The policy MUST distinguish UI preview limits from storage migration limits; omitting inline preview does not by itself require object storage.
- **FR-005**: The policy MUST preserve the existing 512,000-byte inline UI preview ceiling documented by the current artifact normalizer.
- **FR-006**: The policy MUST document what metadata must remain in `artifacts` rows after object storage is introduced: run ID, device ID, step ID, type, content type, size, storage key, creation time, and preview availability state.
- **FR-007**: The policy MUST update roadmap/backend docs so future storage work has measurable entry criteria.
- **FR-008**: The policy MUST avoid implementing object storage in this feature.
- **FR-009**: The policy MUST include verification steps that confirm current artifact normalization tests still pass after documentation changes.

### Key Entities

- **Inline Artifact Row**: Current pilot storage path where evidence metadata and small preview payloads live in the `artifacts` table row.
- **Inline UI Preview Limit**: The current maximum inline preview size used by the UI normalizer before it omits bulky preview payloads and shows metadata summary instead.
- **Object Storage Trigger**: A measurable condition that makes Supabase Storage or equivalent object storage required before scaling artifact usage.
- **Artifact Retention Policy**: The duration and access expectations that determine whether inline row storage remains sufficient.

### Assumptions

- Current code has an inline UI preview ceiling of 512,000 bytes.
- Current pilot artifact rows are acceptable for low-volume validation runs.
- Supabase Storage or equivalent object storage is a future feature, not part of this spec.
- Mobile MCP remains the current pilot-default backend while Laixi clean-path proof is blocked by external availability.

## Proposed Threshold Decision

- Keep inline `artifacts` rows for pilot runs when all of these remain true:
  - Single inline preview payload is at or below 512,000 bytes.
  - A run produces 10 or fewer artifacts total.
  - A run produces 5 or fewer screenshots.
  - Artifact retention is 30 days or less.
  - Artifacts are viewed only inside authenticated app run-detail pages.
- Require object storage planning before scaling when any of these are true:
  - Any artifact preview payload exceeds 512,000 bytes and needs full-fidelity retrieval.
  - A normal run is expected to produce more than 10 artifacts or more than 5 screenshots.
  - Artifact retention must exceed 30 days.
  - Artifacts need external links, exports, customer sharing, or audit packages.
  - Storage costs or database row size becomes visible in Supabase performance or billing reviews.

---

## Review & Acceptance Checklist

### Content Quality

- [x] No object-storage implementation included
- [x] Focused on measurable storage decision value
- [x] Written for mixed product/engineering stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User direction parsed
- [x] Key concepts extracted from roadmap, backend matrix, and artifact normalizer
- [x] Ambiguities resolved through current pilot constraints
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
