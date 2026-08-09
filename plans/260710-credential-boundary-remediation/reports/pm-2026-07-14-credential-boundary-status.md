# Credential Boundary Remediation Status

Date: 2026-07-14
Plan status: `in-progress`
Release claim: `remediation_pending`

| Phase | Delivery status | Evidence |
| --- | --- | --- |
| 1 - Internal worker authorization | Implemented | Unit/integration coverage passes locally. |
| 2 - Plaintext containment | Implemented | Worker, bridge, and redaction tests pass locally. |
| 3 - End-to-end credential proof | Blocked | Static verifier, controlled harness, and Phase 5 orchestrator exist; no real credential runtime proof has run. |

## Current Gates

- Static credential verifier: `static_verified`.
- Phase 5 no-opt-in execution: `blocked`, no DB/device mutation.
- Full release gates: lint, typecheck, Vitest, app build, worker build, Python bridge tests, and `git diff --check` pass.
- Production claim must remain `remediation_pending`.

## Blocking Prerequisites

1. Deployed credential-vault with the worker token configured.
2. Short-lived `PROOF_OPERATOR_JWT` and runtime-only disposable credential.
3. Reachable authenticated bridge, compatible execution worker, and an ONLINE device.
4. Captured worker/bridge log directories for the controlled run.
5. Explicit opt-in: `--run-real-proof` and `CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true`.

## Next Action

Run `node scripts/run-credential-boundary-proof.mjs --run-real-proof` only in the controlled runtime environment. Mark Phase 3 complete and restore no claim until the resulting verifier verdict is `full_verified` with clean scan and verified cleanup.
