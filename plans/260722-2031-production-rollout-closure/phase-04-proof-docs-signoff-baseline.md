---
title: "Phase 04 — Proof, docs, sign-off, and baseline"
status: in-progress
---

# Phase 04 — Proof, docs, sign-off, and baseline

## Context links

Parent: [plan.md](./plan.md); depends on Phases 02B–03. Evidence rules: `docs/project-roadmap.md:5-13,37-44`; proof scripts: `scripts/verify-credential-boundary.mjs`, `scripts/run-credential-boundary-proof.mjs`.

## Overview

Date: 2026-07-25. Description: convert green code gates into an auditable release decision. Priority: P0. Implementation status: static verifier and proof-policy tests pass; fresh real runtime proof and owner sign-off remain blocked on deployment credentials/device. Review status: deployment-owner/security sign-off required.

## Key Insights

- Controlled credential proof is valid only for its defined scope; operational sign-off and key rotation remain open.
- Level 1 evidence expires after 14 days: `docs/project-roadmap.md:37-44`.
- Release plan requires sanitized proof, docs alignment, owner sign-off, rotation, and clean tag.

## Requirements

- Validate proof schema, nonce/canary/hash binding, freshness, and rejection of self-declared evidence.
- Run approved static, unit, build, persistence/log, and controlled Mobile MCP proof.
- Normalize README, PDR, roadmap, deployment guide, codebase summary, and plan statuses.
- Record owner, timestamp, key version, rollback, and exact verification commands for rotation.
- Remove unsanitized artifacts, archive superseded claims, review final diff, create clean tag.

## Architecture

Trusted harness emits proof; repository stores sanitized evidence and metadata tied to the exact commit. Secrets and claim tokens remain outside git and CI logs.

## Related code files

`scripts/verify-credential-boundary.mjs`; `scripts/run-credential-boundary-proof.mjs`; `scripts/verify-mobile-mcp-local.mjs`; `docs/project-roadmap.md:5-54`; `README.md`; `docs/deployment-guide.md`; `docs/codebase-summary.md`.

## Implementation Steps

1. Add proof-parser/nonce tests.
2. Run all automated gates and approved controlled proof.
3. Sanitize and commit only evidence-backed reports.
4. Update docs and plan metadata.
5. Execute owner-approved dry-run, rotation, rollback check, and sign-off.
6. Fresh review, clean commit/tag, and release checklist.

## Todo list

- [x] Proof schema/nonce tests
- [ ] Fresh controlled verification (safe test-mode run is `static_verified`; real proof not requested)
- [x] Evidence sanitization (test-mode verifier emitted no report and no canary violations)
- [x] Docs/status normalization (release closure checklist added)
- [ ] Owner sign-off and key rotation
- [ ] Clean commit/tag

## Success Criteria

Fresh sanitized proof is bound to the release commit; docs match evidence; sign-off and key version are recorded; clean tag is reproducible.

## Risk Assessment

Runtime availability or rotation rollback can delay closure; retain dry-run and rollback artifacts until post-rotation checks pass.

## Security Considerations

Never commit plaintext, service-role keys, worker tokens, JWTs, canaries, or claim tokens. Keep owner-only operations outside automated implementation.

## Next steps

After tag, reassess feature/fleet scale work separately; do not reopen release scope during this phase.
