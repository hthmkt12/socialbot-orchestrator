# Phase 02B Journal — Mobile MCP control-plane proxy

Date: 2026-07-25

Implemented the remaining Mobile MCP browser boundary: the execution worker now exposes authenticated `GET /control/mobile-mcp/devices` and `POST /control/mobile-mcp/devices/:serial/execute-step` routes. The worker validates the Supabase bearer session and `ADMIN`/`OPERATOR` profile role, injects `x-bridge-token` server-side, caps request bodies at 1 MiB, and applies exact-origin CORS with authorization support.

The React orchestrator and device sync use the worker proxy by default. Direct bridge URL/token configuration was removed from the orchestrator UI. `VITE_DEVICE_BACKEND` can explicitly select the existing Laixi local-development sync path until its gateway proxy is implemented; it is not an auth-error fallback.

The same worker proxy now exposes `GET /control/gateway/sessions` and `POST /control/gateway/dispatch-step`; setup/readiness probes use those authenticated routes for both Laixi and Mobile MCP. Direct gateway/bridge URLs remain only in legacy low-level helpers and explicit local-development configuration.

Integration-style proxy tests now cover authenticated gateway forwarding and malformed JSON handling. Verification: focused proxy/orchestrator/setup tests pass, full root suite previously 522/522, typecheck, lint, frontend build, worker build, and `git diff --check` pass. Remaining work is auditing legacy health-only calls.
