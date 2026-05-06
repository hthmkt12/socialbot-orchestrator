# Feature Specification: Normalize Pilot Artifact Storage

**Feature Branch**: `001-normalize-pilot-artifact`<br>
**Created**: 2026-05-06<br>
**Status**: Draft<br>
**Input**: User description: "normalize pilot artifact storage"

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a pilot operator reviewing workflow evidence, I need screenshots, logs, and structured step outputs to be consistently labeled, linked to the right run/device/step, and understandable before the platform grows into higher-volume storage.

### Acceptance Scenarios

1. **Given** a completed pilot run with screenshot evidence, **When** an operator opens run details, **Then** each artifact clearly shows its type, source step, source device, creation time, and whether the content is inline pilot evidence or requires external storage later.
2. **Given** a run step emits multiple evidence items, **When** artifacts are listed, **Then** the operator can distinguish screenshots from logs and JSON results without inspecting raw payloads.
3. **Given** pilot documentation is used to decide storage readiness, **When** a maintainer reads the artifact guidance, **Then** it clearly states that inline artifacts are acceptable for small pilot volume and defines when Supabase Storage or equivalent object storage becomes required.
4. **Given** an artifact record is missing expected linkage or preview content, **When** the operator views run evidence, **Then** the UI should degrade clearly instead of implying evidence is complete.

### Edge Cases

- Artifact exists without a matching step because the run schema or historical data is incomplete.
- Artifact content is too large or unavailable for inline preview.
- A screenshot artifact has metadata but no preview payload.
- A log or JSON result is present without a human-friendly label.
- Multiple devices emit artifacts for the same step ID in a multi-target run.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST present every run artifact with a clear evidence type label: screenshot, log, JSON result, or unknown.
- **FR-002**: System MUST associate artifacts with their workflow run, device, and step when that information is available.
- **FR-003**: System MUST make missing artifact linkage visible to operators rather than silently hiding affected evidence.
- **FR-004**: System MUST keep inline artifact usage acceptable for small pilot runs.
- **FR-005**: System MUST document thresholds or trigger conditions for moving artifacts to external object storage before larger screenshot volume, longer retention, or external sharing.
- **FR-006**: System MUST preserve existing access-control expectations for artifact viewing.
- **FR-007**: System MUST avoid changing the pilot execution path unless needed to normalize artifact metadata or display.
- **FR-008**: System MUST provide verification evidence that existing run artifact views and pilot execution checks still work after normalization.

### Key Entities

- **Run Artifact**: Evidence produced by a workflow run, such as a screenshot, log blob, or JSON result. It has a type, source run, optional source device, optional source step, creation time, and preview availability.
- **Artifact Source**: The run/device/step context that explains where an artifact came from.
- **Storage Decision**: The documented rule that explains whether current pilot evidence stays inline or must move to object storage for higher scale.

### Assumptions

- Small pilot volume means short-lived validation runs with limited screenshots and no external artifact sharing requirement.
- External object storage is a later scale requirement, not a blocker for the first pilot.
- Existing role-based access rules for artifact rows remain the authority for who can view evidence.

---

## Review & Acceptance Checklist

### Content Quality

- [x] No implementation details
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved through current pilot docs
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
