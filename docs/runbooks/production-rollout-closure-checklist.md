# Production Rollout Closure Checklist

## Verified automatically

- [x] `npm.cmd run test:all` — 53 files / 528 tests
- [x] `npm.cmd run typecheck`
- [x] `npm.cmd run lint`
- [x] `npm.cmd run build`
- [x] `npm.cmd run build:worker`
- [x] `npm.cmd run test:e2e:deterministic` — visitor auth smoke
- [x] `npm.cmd run verify:credential-boundary` in deterministic test mode — `static_verified`
- [x] Browser control routes use authenticated worker proxies; backend tokens remain server-side

## Required owner/deployment actions

- [ ] Confirm production `WORKER_CORS_ORIGIN` and gateway CORS origin.
- [ ] Confirm `GATEWAY_HTTP_TOKEN`, enrollment token, bridge token, vault worker token, and rotation owner.
- [ ] Execute approved key-rotation dry run and record key version/time window.
- [ ] Run the real credential-boundary proof with both explicit opt-ins, a connected Android device, disposable account, persistence/log scans, and cleanup verification.
- [ ] Review the resulting sanitized evidence against the exact release commit.
- [ ] Approve rollback procedure and create the clean release commit/tag.

## Verdict policy

`static_verified` is the highest safe result without runtime proof. Do not claim `full_verified` unless the auth matrix, credential login run, persistence/log scans, and cleanup are all successful and bound to the release evidence.

## Known dependency decisions

React Router remains on the React 18-compatible line pending a planned React 19 migration. Tailwind's transitive Sucrase/Glob advisory is documented; do not apply force upgrades during release closure.
