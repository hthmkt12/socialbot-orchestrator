# Next Use Cases: Pilot Readiness And Safe Scale

Date: 2026-07-07
Status: proposed-next-scope

## Purpose

This file captures recommended next use cases after the current MVP use-case set reached full coverage.

Do not treat these as implemented behavior yet. Promote a group into `docs/use-cases.md` only when the team accepts it as active scope.

## Why This Scope

The current product already covers the core internal automation flow: auth, read-only review, operator workflows, admin governance, worker execution, Mobile MCP bridge, scheduler, and out-of-scope guardrails.

The next valuable step is not adding marketplace, billing, public social networking, native mobile, or AI workflow builder. The next valuable step is making the pilot safer to operate and easier to prove.

Recommended theme: Pilot Readiness and Safe Scale.

## Roles

- Viewer: authenticated read-only user.
- Operator: runs workflows and handles daily social/device operations.
- Admin: governs users, policy, credentials boundary, verification decisions, and storage/retention policy.
- System Worker: executes runs, retries, failover, and persistence.
- Mobile MCP Bridge: provides device/session proof and platform-specific capability signals.

## Admin

### Co the

- La admin, toi co the xem credential risk status cua workspace ma khong thay plaintext social password.
- La admin, toi co the rotate hoac revoke credential encryption key/policy de giam rui ro credential pilot.
- La admin, toi co the review mot verification report va mark ket qua la `pilot_verified`, `not_verified`, hoac `needs_rerun`.
- La admin, toi co the xem bang chung bat buoc cua pilot readiness gom runtime health, device serial, backend mode, run id, artifact evidence, va thoi diem verify.
- La admin, toi co the cau hinh artifact retention policy cho screenshot/log/json artifacts trong gioi han MVP.
- La admin, toi co the cau hinh storage mode khi artifact vuot nguong inline policy hien co.
- La admin, toi co the cau hinh retry/backoff profile mac dinh cho execution profiles.
- La admin, toi co the cau hinh failover policy mac dinh cho device/account rotation trong pilot runs.

### Khong the

- La admin, toi KHONG THE xem plaintext social password trong UI hoac report.
- La admin, toi KHONG THE mark pilot verified neu report thieu device/session/run evidence bat buoc.
- La admin, toi KHONG THE mark pilot verified neu report thieu `verified_at`, timestamp khong hop le, hoac evidence da qua cua so 14 ngay.
- La admin, toi KHONG THE claim Laixi live readiness neu report khong co VIP/API/live session proof.
- La admin, toi KHONG THE claim iOS readiness neu report khong co Portal app va iproxy proof.
- La admin, toi KHONG THE cau hinh artifact retention vo han trong DB inline rows.
- La admin, toi KHONG THE bat failover sang account blocked hoac device offline/stale/locked.
- La admin, toi KHONG THE bat retry vo han cho workflow steps.

### Khi loi

- La admin, khi credential key/policy rotation dang co run active, thi he thong canh bao risk va khong rotate neu rotation co the lam hong run dang chay.
- La admin, khi verification report thieu run id, artifact evidence, hoac fresh `verified_at`, thi he thong khong cho mark `pilot_verified`.
- La admin, khi storage mode hoac retention policy vuot nguong MVP, thi he thong tu choi va noi ro nguong hop le.
- La admin, khi failover policy khong co target hop le, thi he thong bao loi policy invalid va khong luu.
- La admin, khi retry/backoff profile co max retry am, delay khong hop le, hoac retry vo han, thi validation tu choi.

## Operator

### Co the

- La operator, toi co the chay pilot readiness checklist truoc khi claim mot backend/device dang san sang.
- La operator, toi co the xem report go/no-go cho Mobile MCP local runtime gom bridge, worker, UI, Supabase, expected serials, va smoke run result.
- La operator, toi co the xem ly do account/device bi loai khoi run target va hanh dong recovery duoc de xuat.
- La operator, toi co the chon rotation policy cho social engagement run neu policy da duoc admin cho phep.
- La operator, toi co the chon failover behavior: fail fast, skip failed target, hoac rotate sang target du phong theo policy.
- La operator, toi co the xem analytics co nhan ro `real persisted data`, `seed data`, hoac `insufficient data`.
- La operator, toi co the xem retry/backoff timeline trong run monitor de hieu vi sao step duoc retry.

### Khong the

- La operator, toi KHONG THE mark pilot readiness la verified; operator chi co the tao report hoac request review.
- La operator, toi KHONG THE sua credential policy, artifact retention policy, hoac global failover policy.
- La operator, toi KHONG THE chon rotation/failover sang account blocked hoac device khong dispatchable.
- La operator, toi KHONG THE coi seed/demo analytics la real pilot metric.
- La operator, toi KHONG THE bypass retry/backoff limit cua execution profile.

### Khi loi

- La operator, khi expected device serial khong online, thi checklist fail voi missing serial va recovery hint.
- La operator, khi bridge/worker/UI/Supabase khong healthy, thi readiness report fail va ghi ro failed step.
- La operator, khi account/device khong con dispatchable trong luc review run, thi preflight refresh va chan dispatch.
- La operator, khi analytics khong co persisted data, thi UI hien `insufficient data` thay vi ve metric gia.
- La operator, khi failover khong tim duoc target thay the hop le, thi run follow configured behavior: fail fast hoac skip target.

## Viewer

### Co the

- La viewer, toi co the xem pilot readiness status read-only de biet backend/device nao da duoc verified.
- La viewer, toi co the xem analytics va report voi nhan data-source ro rang.
- La viewer, toi co the xem run retry/failover timeline read-only.

### Khong the

- La viewer, toi KHONG THE tao readiness report, mark verified, rotate credential policy, hoac thay doi failover/retry policy.
- La viewer, toi KHONG THE xem secret, token, credential key, hoac plaintext password.

### Khi loi

- La viewer, khi report/artifact bi RLS tu choi, thi he thong hien access-safe empty state.
- La viewer, khi readiness report da bi xoa hoac het han, thi he thong hien not found/expired state.

## System Worker

### Co the

- La system worker, toi co the retry step theo backoff policy co max retry va max elapsed time.
- La system worker, toi co the ghi retry reason, retry attempt, next retry delay, va terminal failure reason vao run step output/error.
- La system worker, toi co the failover sang device du phong khi target offline/stale/locked neu policy cho phep.
- La system worker, toi co the failover sang account du phong khi account bi blocked hoac het budget neu policy cho phep.
- La system worker, toi co the danh dau target skipped khi failover policy la skip failed target.
- La system worker, toi co the persist failover decision vao audit/run summary de operator review.

### Khong the

- La system worker, toi KHONG THE retry vo han.
- La system worker, toi KHONG THE retry sensitive step khi approval gate chua hop le.
- La system worker, toi KHONG THE failover sang account blocked, het budget, hoac khong match platform.
- La system worker, toi KHONG THE failover sang device offline/stale/locked hoac sai platform capability.
- La system worker, toi KHONG THE che dau original failure khi failover thanh cong; run summary van phai ghi failure + recovery path.

### Khi loi

- La system worker, khi retry profile invalid, thi fail run/step voi config error thay vi loop.
- La system worker, khi tat ca target du phong deu khong hop le, thi apply failover fallback: fail fast hoac skip theo policy.
- La system worker, khi failover target bi lock trong luc dispatch, thi acquire lock fail va tiep tuc fallback neu con target.
- La system worker, khi account budget het giua run, thi stop hoac rotate theo policy va ghi action budget reason.

## Mobile MCP Bridge

### Co the

- La mobile MCP bridge, toi co the include platform capability summary trong health/device response.
- La mobile MCP bridge, toi co the report evidence fields can thiet cho readiness report: platform, serial/session id, auth mode, session count, va supported actions.
- La mobile MCP bridge, toi co the report iOS Portal proof status khi platform la iOS.

### Khong the

- La mobile MCP bridge, toi KHONG THE claim iOS ready neu khong co Portal session proof.
- La mobile MCP bridge, toi KHONG THE claim Laixi ready; Laixi proof thuoc gateway/backend report rieng.
- La mobile MCP bridge, toi KHONG THE expose bridge token hoac secret trong health/report response.

### Khi loi

- La mobile MCP bridge, khi device capability probe fail, thi response report `capability_unknown` thay vi fake support.
- La mobile MCP bridge, khi iOS Portal khong reachable, thi readiness evidence ghi `portal_unavailable`.

## New System Does Not Do

- Khong them billing/payment/subscription.
- Khong them marketplace macro/template.
- Khong them public social graph/network.
- Khong them native mobile app.
- Khong claim anti-bot guarantee.
- Khong claim Laixi/iOS readiness khi chua co proof.
- Khong expose plaintext credentials, bridge tokens, service-role keys, hoac encryption keys.
- Khong tao external customer sharing/export audit package trong scope nay.

## Recommended Implementation Order

1. Pilot readiness report workflow: create/review/mark reports without changing runtime execution.
2. Analytics data-source labeling: make real/seed/insufficient data explicit.
3. Retry/backoff policy: worker behavior and run monitor visibility.
4. Failover/rotation policy: account/device fallback with strict guardrails.
5. Credential risk/rotation policy: admin visibility without plaintext.
6. Artifact retention/storage policy: keep inline DB row limits honest.

## Acceptance Gate Before Promotion

Before moving any group into `docs/use-cases.md`, answer:

- Which role owns the behavior?
- What exact data model changes are needed?
- What anti-use-case rule enforces the dangerous boundary?
- What test proves the boundary?
- Is this still inside MVP, or should it stay proof-gated/backlog?
