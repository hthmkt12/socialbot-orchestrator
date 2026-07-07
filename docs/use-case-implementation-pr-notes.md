# Use Case Implementation PR Notes

## Scope

This change set implements the role/flow sequence documented in:

- `docs/use-cases.md`
- `docs/use-cases-architecture-spec.md`
- `docs/use-case-coding-sequence.md`
- `docs/use-case-final-coverage.md`

## Recommended Commit Groups

1. **Docs and traceability**
   - Use-case source/spec/sequence/final coverage docs
   - Roadmap/changelog/system architecture updates

2. **RBAC and frontend role boundaries**
   - `src/lib/role-access.ts`
   - Visitor auth flow
   - Viewer read-only UI guards
   - Out-of-scope route guardrails for billing/payment/pricing scope

3. **Operator account/run/schedule flows**
   - Account service validation
   - Run wizard account/preflight checks
   - Approval resolved-state handling
   - Schedule service and scheduler trigger guards

4. **Admin governance**
   - `src/lib/admin-governance.ts`
   - Audit log scoping
   - Admin delete dependency checks

5. **Worker and Mobile MCP bridge hardening**
   - Worker artifact policy
   - Mobile MCP backend error mapping
   - Python bridge token/session/platform/package/screenshot guards

6. **Tests**
   - Unit tests for role, auth, account, schedule, admin, worker, bridge, out-of-scope guardrails
   - E2E tests for visitor/viewer/operator flows

## Review Notes

- `playwright-report/` and `test-results/` are generated Playwright outputs and are ignored; do not commit regenerated reports.
- Several existing docs and runtime files were already dirty before the final consolidation pass; review by commit group instead of one giant diff.
- The final coverage report marks intentional MVP boundaries as `partial`, especially Admin execution profile UI, Laixi/iOS live proof, and social-platform safety guarantees.

## Verification Run

- `npm.cmd run test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run build:worker`
- `python -m unittest discover -s services\mobile-mcp-bridge\tests -p "test_*.py"`
- `python -m py_compile services\mobile-mcp-bridge\src\android_session_manager.py services\mobile-mcp-bridge\src\bridge_server.py services\mobile-mcp-bridge\src\json_response.py`
