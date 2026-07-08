# Use Cases

Source of truth for current product behavior and near-term MVP scope.

Date: 2026-07-08

## Context

Product: SocialBot Orchestrator, an internal Android device automation and social workflow pilot platform.

Current strongest proof: Mobile MCP Android local runtime verified on real device `97249fb5` / model `25053RT47C`, with first social pilot run `a414e519-c1ac-44df-b287-e91e845f0084` completing 4 steps, screenshot artifact `c741ceb8-0cba-4096-ad02-b107878f4dbd`, and readiness report `76e0141b-2e23-475c-97ea-d4214d50d3d3` marked `pilot_verified`.

Readiness evidence is valid for 14 days from `verified_at`; rerun verification when it expires or when the pilot device, backend runtime, bridge auth mode, Supabase project, or proof workflow changes.

Primary constraint: production-grade social account credential handling, Laixi live proof, iOS Portal proof, and large-scale social bot claims are not in current verified scope.

## Roles

- Visitor: user who is not logged in.
- Viewer: authenticated read-only user.
- Operator: authenticated user who runs workflows and manages daily automation operations.
- Admin: authenticated user with elevated control over profiles, deletes, audit visibility, and system-level configuration.
- System Worker: backend execution worker that claims queued runs and executes steps.
- Mobile MCP Bridge: local bridge process that talks to Android/iOS devices.
- Scheduler: background schedule trigger that creates workflow runs from configured schedules.

## Visitor

### Co the

- La visitor, toi co the open app de thay login/register screen.
- La visitor, toi co the dang ky tai khoan de duoc tao profile mac dinh.
- La visitor, toi co the dang nhap bang email/password de vao workspace.
- La visitor, toi co the xem thong bao loi dang nhap de sua credential.

### Khong the

- La visitor, toi KHONG THE xem dashboard, devices, macros, runs, accounts, analytics noi bo - can dang nhap.
- La visitor, toi KHONG THE tao run hoac gui lenh device - can profile authenticated.
- La visitor, toi KHONG THE xem artifact, audit log, approval, account password - tranh lo du lieu van hanh.
- La visitor, toi KHONG THE tu gan role cho minh - role nam trong profile/RLS.

### Khi loi

- La visitor, khi toi dang nhap sai email/password, thi he thong bao loi dang nhap va giu toi o login screen.
- La visitor, khi toi truy cap URL noi bo khi chua login, thi he thong chuyen ve login.
- La visitor, khi dang ky that bai do email da ton tai hoac Supabase loi, thi he thong bao loi va khong tao session.
- La visitor, khi mang/Supabase auth mat ket noi, thi he thong bao loi thay vi vao app rong.

## Viewer

### Co the

- La viewer, toi co the xem Social Dashboard de nam suc khoe account va hoat dong tong quan.
- La viewer, toi co the xem danh sach devices va device groups de biet fleet hien tai.
- La viewer, toi co the xem macros va macro versions de review logic automation.
- La viewer, toi co the xem runs, run detail, run monitor, steps, errors, va artifacts duoc phep.
- La viewer, toi co the xem approvals o che do read-only de hieu run dang doi gi.
- La viewer, toi co the xem accounts, warm-up stage, block flag, daily limits, va action history neu RLS cho phep.
- La viewer, toi co the xem fleet health, system monitor, analytics, va cac man hinh van hanh read-only.
- La viewer, toi co the xem thong bao role read-only khi vao khu vuc co hanh dong operator.
- La viewer, toi co the xem pilot readiness reports de biet backend nao da duoc submit/verify.
- La viewer, toi co the xem readiness evidence con fresh hay da expired/missing de biet report co can rerun khong.
- La viewer, toi co the xem analytics data source label de biet chart dang dung real persisted data, insufficient data, hay unknown source.
- La viewer, toi co the xem retry/backoff timeline read-only trong run detail/monitor khi step duoc retry.

### Khong the

- La viewer, toi KHONG THE launch run - viewer role bi preflight block.
- La viewer, toi KHONG THE cancel run dang chay - chi operator/admin moi quan ly run control.
- La viewer, toi KHONG THE approve/reject approval - viewer chi inspect.
- La viewer, toi KHONG THE tao, sua, publish, archive, hoac xoa macro - chi operator/admin.
- La viewer, toi KHONG THE tao/sua/xoa devices, groups, locks, execution profiles - chi role cao hon.
- La viewer, toi KHONG THE tao/import/xoa social accounts - tranh thay doi credential va van hanh.
- La viewer, toi KHONG THE xem audit logs neu UI/RLS yeu cau operator/admin.
- La viewer, toi KHONG THE thay doi role cua user khac - chi admin.
- La viewer, toi KHONG THE submit hoac review pilot readiness report - viewer chi doc.

### Khi loi

- La viewer, khi toi bam launch run, thi he thong chan voi loi `Viewer role cannot launch runs`.
- La viewer, khi toi mo dialog approval va submit approve/reject, thi he thong hien read-only notice va khong gui update.
- La viewer, khi macro hoac run da bi xoa trong luc toi dang xem, thi he thong bao not found/empty state.
- La viewer, khi artifact khong doc duoc hoac payload preview qua lon, thi he thong hien metadata/error thay vi crash.
- La viewer, khi RLS tu choi doc bang, thi he thong hien loi truy cap hoac empty state an toan.
- La viewer, khi analytics khong co persisted rows, thi he thong hien source label `Insufficient data` thay vi coi account health la tot.

## Operator

### Co the

- La operator, toi co the xem Social Dashboard de dieu hanh account health, warm-up, blocked accounts, va daily action usage.
- La operator, toi co the them social account thu cong de dung trong social engagement runs.
- La operator, toi co the import nhieu accounts tu CSV de setup van hanh nhanh.
- La operator, toi co the bat dau warm-up cho account de tang stage theo quy tac hien co.
- La operator, toi co the xem action history cua account de audit hanh dong da chay.
- La operator, toi co the xem va quan ly devices/device groups de chon target automation.
- La operator, toi co the sync Android devices tu ADB vao DB bang local Mobile MCP tooling.
- La operator, toi co the tao hoac load sample macros de chuan hoa workflow.
- La operator, toi co the xem, sua, publish macro versions neu duoc UI/RLS cho phep.
- La operator, toi co the tao workflow run cho single device, multi device, device group, hoac all devices.
- La operator, toi co the chon account trong run wizard cho social engagement macro.
- La operator, toi co the dien input variables cho macro truoc khi launch run.
- La operator, toi co the xem preflight issues truoc khi dispatch run.
- La operator, toi co the cancel run dang chay de dung automation loi.
- La operator, toi co the approve/reject approval checkpoints cho ADB/script-sensitive steps.
- La operator, toi co the xem run monitor realtime de debug step status, retries, error, artifacts.
- La operator, toi co the dung Device Setup de kiem tra bridge/worker/UI/device readiness.
- La operator, toi co the dung Mobile MCP Orchestrator page de thao tac fleet Android co ban nhu launch app, get foreground app, screenshot.
- La operator, toi co the tao va quan ly schedules neu bang schedule/RLS trong moi truong da san sang.
- La operator, toi co the xem analytics va fleet health de ra quyet dinh van hanh.
- La operator, toi co the submit pilot readiness report kem evidence da scrub secret de admin review.
- La operator, toi co the xem go/no-go readiness evidence va status review cua cac backend pilot.
- La operator, toi co the xem nhan freshness cua readiness evidence de biet khi nao can rerun truoc khi xin verify.
- La operator, toi co the xem retry reason, retry attempt, next retry delay, va terminal failure reason trong run monitor/detail.
- La operator, toi co the xem target failure policy va quyet dinh skip/fail-fast cua multi-target run trong run summary.

### Khong the

- La operator, toi KHONG THE gan/thu hoi role user - chi admin.
- La operator, toi KHONG THE xoa devices/macros/execution profiles neu RLS yeu cau admin.
- La operator, toi KHONG THE xem toan bo audit logs neu policy chi cho admin xem tat ca.
- La operator, toi KHONG THE bypass approval cho step nhay cam neu macro policy yeu cau approval.
- La operator, toi KHONG THE chay run neu target offline, locked, stale heartbeat, hoac target mode khong khop macro.
- La operator, toi KHONG THE luu account password neu thieu `VITE_ACCOUNT_PASSWORD_KEY`.
- La operator, toi KHONG THE su dung bridge protected endpoints khi bridge token thieu, tru khi local insecure dev mode duoc bat ro rang.
- La operator, toi KHONG THE chay `run_autox` qua Mobile MCP V1 - backend hien khong support.
- La operator, toi KHONG THE hua automation social production-safe hoac anti-detection dam bao - chi pilot/internal proof.
- La operator, toi KHONG THE mark backend la `pilot_verified` - chi admin moi duoc review readiness.
- La operator, toi KHONG THE bypass retry/backoff limit cua execution profile.
- La operator, toi KHONG THE chon failover sang device offline, stale, locked, hoac khong nam trong resolved dispatchable targets.

### Khi loi

- La operator, khi import CSV thieu username/password/platform, thi he thong bao row loi va khong import row do.
- La operator, khi CSV co platform khong phai instagram/tiktok/facebook, thi he thong tu choi row va bao loi cu the.
- La operator, khi tao account ma encryption key thieu/qua ngan, thi he thong bao loi inline va khong luu password.
- La operator, khi launch run ma macro thieu input bat buoc, thi preflight bao blocking issue.
- La operator, khi launch run ma selected account bi blocked, thi run wizard/preflight phai chan hoac canh bao theo policy.
- La operator, khi target device offline/stale/locked, thi preflight hoac device setup hien blocker va khong dispatch an toan.
- La operator, khi worker/bridge/UI/Supabase khong healthy, thi `preflight:mobile-mcp` fail va ghi report.
- La operator, khi device serial expected khong online, thi wait/diagnose bao serial missing va de xuat recovery.
- La operator, khi bridge thieu token va insecure dev mode tat, thi protected endpoint tra 503.
- La operator, khi step device timeout, thi run step status thanh FAILED va luu error/artifact log.
- La operator, khi run dang doi approval, thi run status thanh WAITING_APPROVAL va release ownership de resume sau.
- La operator, khi approve item da het han/bi xoa/da resolve, thi he thong bao khong con approval hop le.
- La operator, khi cancel run da terminal, thi he thong khong lap lai side effect va bao trang thai hien tai.
- La operator, khi submit readiness evidence co key nhu secret/token/password/apiKey, thi he thong scrub cac field do truoc khi luu.

## Admin

### Co the

- La admin, toi co the lam tat ca use case cua operator.
- La admin, toi co the xem tat ca audit logs de dieu tra thay doi he thong.
- La admin, toi co the doc profile/role cua users de quan tri workspace.
- La admin, toi co the cap nhat role user trong DB/admin tooling theo policy hien co.
- La admin, toi co the tao, sua, xoa execution profiles neu UI/tooling expose.
- La admin, toi co the xoa devices, device groups, macros, va cac cau hinh admin-only theo RLS.
- La admin, toi co the cleanup device locks khi thiet bi bi ket.
- La admin, toi co the cau hinh deployment/env secrets ngoai app nhu Supabase service role, bridge token, account password key.
- La admin, toi co the review verification reports de quyet dinh pilot readiness.
- La admin, toi co the quyet dinh khi nao bat `MOBILE_MCP_ALLOW_INSECURE_DEV=true` cho isolated local development.
- La admin, toi co the review pilot readiness report trong app va set status `pilot_verified`, `not_verified`, hoac `needs_rerun`.
- La admin, toi co the chi mark `pilot_verified` khi evidence co `verified_at` con trong cua so 14 ngay.
- La admin, toi co the cau hinh retry/backoff policy cho execution profile gom max retries, base delay, max delay, va max elapsed.
- La admin, toi co the cau hinh target failure policy cho execution profile: `fail_fast` hoac `skip_failed_target`.

### Khong the

- La admin, toi KHONG THE bypass Supabase Auth/RLS neu khong co backend/service-role context.
- La admin, toi KHONG THE doc plaintext social account password tu UI - password chi duoc luu encrypted pilot payload.
- La admin, toi KHONG THE dam bao social platform se khong detect automation - day la external platform risk.
- La admin, toi KHONG THE chay Laixi live proof neu khong co VIP/API/live session.
- La admin, toi KHONG THE chay iOS device automation neu chua co Portal app va iproxy.
- La admin, toi KHONG THE scale artifact storage vo han bang inline DB rows - object storage can khi vuot nguong.
- La admin, toi KHONG THE coi pricing route la billing system - pricing/billing khong nam trong MVP runtime.
- La admin, toi KHONG THE mark `pilot_verified` neu report thieu backend proof, device/session evidence, hoac completed run/smoke evidence.
- La admin, toi KHONG THE mark `pilot_verified` neu readiness evidence thieu timestamp, timestamp khong hop le, hoac da qua 14 ngay.
- La admin, toi KHONG THE cau hinh retry vo han hoac retry/backoff delay khong hop le.
- La admin, toi KHONG THE cau hinh target failure policy ngoai `fail_fast` hoac `skip_failed_target`.

### Khi loi

- La admin, khi update role voi role khong hop le, thi DB check constraint tu choi.
- La admin, khi xoa resource dang duoc run/schedule tham chieu, thi he thong hoac DB phai chan/xu ly foreign key an toan.
- La admin, khi service-role env thieu, thi worker/gateway/diagnostic thao tac backend se fail co message ro.
- La admin, khi bridge auth token mismatch, thi protected endpoint tra 401.
- La admin, khi bat insecure dev mode ngoai local, thi day la misconfiguration risk va phai rollback.
- La admin, khi storage/artifact payload vuot inline preview limit, thi he thong khong nen chen payload lon vao UI preview.
- La admin, khi verify readiness ma evidence thieu, thi service tu choi voi danh sach evidence can bo sung.
- La admin, khi verify readiness ma evidence expired, thi service tu choi va yeu cau rerun verification truoc khi pilot verified.
- La admin, khi retry/backoff profile co max retry am/qua cao, delay khong hop le, hoac max elapsed qua nguong, thi validation tu choi truoc khi luu.
- La admin, khi target failure policy khong hop le, thi validation tu choi truoc khi luu.

## System Worker

### Co the

- La system worker, toi co the claim QUEUED workflow runs bang lease/claim token de tranh duplicate execution.
- La system worker, toi co the renew lease/heartbeat trong luc run dang chay.
- La system worker, toi co the resolve target devices tu single device, multi device, device group, hoac all devices.
- La system worker, toi co the execute macro steps qua configured backend: mobile-mcp, mobilerun, hoac laixi.
- La system worker, toi co the persist run_steps, output_json, error_json, retry_count, va screenshot artifact reference.
- La system worker, toi co the tao approval requests cho approval_checkpoint hoac policy requiresApproval.
- La system worker, toi co the release run ownership khi WAITING_APPROVAL de run co the resume sau approval.
- La system worker, toi co the cancel run khi status/cancel signal duoc set.
- La system worker, toi co the enforce action budget cho step co `params.actionBudgetType`.
- La system worker, toi co the record account_action_history khi action thanh cong.
- La system worker, toi co the mark account blocked khi phat hien block signal trong error/output.
- La system worker, toi co the aggregate run result thanh COMPLETED, FAILED, PARTIAL_SUCCESS, CANCELLED, hoac WAITING_APPROVAL.
- La system worker, toi co the retry step theo retry/backoff policy voi max retry va max elapsed time.
- La system worker, toi co the persist retry reason, retry attempt, next retry delay, va terminal failure reason vao step output/error.
- La system worker, toi co the ap dung multi-target failure policy: dung cac target con lai voi `fail_fast`, hoac tiep tuc target con lai voi `skip_failed_target`.
- La system worker, toi co the persist target failure decision vao run summary ma khong che dau original failure.

### Khong the

- La system worker, toi KHONG THE claim run neu execution_claim_token khong khop hoac lease khong thuoc ve minh.
- La system worker, toi KHONG THE chay step tren device dang bi lock boi run khac.
- La system worker, toi KHONG THE execute sensitive step truoc khi approval gate duoc approve.
- La system worker, toi KHONG THE decrypt credential production-grade tren server vi credential encryption hien con pilot/browser boundary.
- La system worker, toi KHONG THE dam bao parallel fleet speed neu multi-target dang duoc quyet dinh la sequential pilot path.
- La system worker, toi KHONG THE execute backend step khong support nhu `run_autox` tren Mobile MCP V1.
- La system worker, toi KHONG THE retry vo han; retry phai dung khi het max retries hoac max elapsed.
- La system worker, toi KHONG THE che dau original target failure khi policy tiep tuc hoac dung cac target con lai.

### Khi loi

- La system worker, khi device lock khong acquire duoc, thi device result FAILED voi code DEVICE_LOCKED.
- La system worker, khi step timeout, thi persist step FAILED voi code STEP_TIMEOUT.
- La system worker, khi backend bridge request abort/fail, thi step FAILED voi bridge error.
- La system worker, khi run bi cancel giua sequence, thi persist step CANCELLED va finalize run CANCELLED/PARTIAL.
- La system worker, khi approval pending, thi persist WAITING_APPROVAL va khong tiep tuc step sau.
- La system worker, khi worker crash/exception, thi finalize run FAILED voi error code phu hop neu con claim.
- La system worker, khi schedule table/env chua san sang, thi log loi va khong lam sap worker core claim loop.
- La system worker, khi target failure policy la `fail_fast` va mot target fail, thi worker dung dispatch target chua bat dau va ghi skipped count.

## Mobile MCP Bridge

### Co the

- La mobile MCP bridge, toi co the expose `/health` de bao service status, auth mode, va session count.
- La mobile MCP bridge, toi co the expose `/devices` de liet ke Android ADB devices hoac iOS Portal sessions.
- La mobile MCP bridge, toi co the execute Android steps co ban: launch_app, input_text, tap, swipe, screenshot, get_current_app, adb, press_button.
- La mobile MCP bridge, toi co the execute worker-local-compatible step request theo serial device.
- La mobile MCP bridge, toi co the dung ADB-first Android session mac dinh de tranh Portal install timeout tren device chan USB install.
- La mobile MCP bridge, toi co the attempt Portal setup khi `MOBILE_MCP_ENSURE_PORTAL_ON_SESSION=true`.
- La mobile MCP bridge, toi co the bao loi authRequired/insecureDevMode trong health response.

### Khong the

- La mobile MCP bridge, toi KHONG THE cho protected endpoints pass khi thieu token, tru khi `MOBILE_MCP_ALLOW_INSECURE_DEV=true`.
- La mobile MCP bridge, toi KHONG THE execute iOS ADB-only steps nhu `adb` hoac `get_current_app`.
- La mobile MCP bridge, toi KHONG THE install Portal neu device policy/user restriction chan USB install.
- La mobile MCP bridge, toi KHONG THE xu ly social platform logic cao cap; no chi dispatch device-level actions.
- La mobile MCP bridge, toi KHONG THE bo qua same-device serialization; cung mot serial can duoc serialize de tranh xung dot.

### Khi loi

- La mobile MCP bridge, khi protected endpoint thieu token va insecure dev tat, thi tra 503.
- La mobile MCP bridge, khi token sai, thi tra 401.
- La mobile MCP bridge, khi serial khong ton tai/offline, thi tra loi device/session.
- La mobile MCP bridge, khi package name Android khong hop le, thi `launch_app` tra loi invalid package.
- La mobile MCP bridge, khi ADB shell/driver call fail, thi response `success=false` voi message ro.
- La mobile MCP bridge, khi screenshot fail, thi khong tao artifact gia va tra loi that bai.

## Scheduler

### Co the

- La scheduler, toi co the doc active workflow schedules de tao workflow runs theo cron expression/timezone.
- La scheduler, toi co the tinh next_run_at de biet lan chay tiep theo.
- La scheduler, toi co the tao queued workflow run bang macro_version, target, va input variables trong schedule.
- La scheduler, toi co the cap nhat last_run_at/next_run_at sau khi trigger.

### Khong the

- La scheduler, toi KHONG THE chay run truc tiep tren device - worker moi claim va execute.
- La scheduler, toi KHONG THE bypass role/RLS trong UI; schedule config van phai duoc tao boi user hop le.
- La scheduler, toi KHONG THE dam bao run thanh cong neu runtime/device/bridge offline tai thoi diem trigger.
- La scheduler, toi KHONG THE tu approve sensitive steps.

### Khi loi

- La scheduler, khi schedule table chua co trong schema cache, thi worker log loi va tiep tuc core claim loop.
- La scheduler, khi cron expression/timezone sai, thi schedule khong nen duoc luu hoac phai bao validation error.
- La scheduler, khi macro_version_id khong con ton tai, thi trigger phai fail co message va khong tao run hong.
- La scheduler, khi target device/group khong hop le, thi run preflight/worker se block hoac fail an toan.

## He thong KHONG lam

- Khong co marketplace ban macro/template.
- Khong co billing/payment/subscription thuc te trong MVP; khong co pricing/billing route trong runtime.
- Khong co public social network trong app nhu like/share/follow giua nguoi dung.
- Khong co real-time collaborative macro editing.
- Khong co guarantee bypass anti-bot/anti-detection cua Instagram, TikTok, Facebook.
- Khong co production-grade credential vault cho social account password; browser encryption key chi la pilot-only.
- Khong tu dong tao hoac mua social accounts.
- Khong tu dong publish/post noi dung nhay cam mac dinh; publish phai review-gated/explicit allow.
- Khong support `run_autox` execution qua Mobile MCP V1.
- Khong claim Laixi live readiness neu chua co VIP/API/live session proof.
- Khong claim iOS readiness neu chua co Portal app + iproxy proof.
- Khong scale artifact storage vo han trong DB rows; object storage can khi vuot nguong policy.
- Khong co external customer sharing/export audit package trong MVP.
- Khong co SLA fleet parallel speed; sequential multi-target la acceptable pilot decision.
- Khong co native mobile app; current UI la web app.
- Khong co offline-first mode; Supabase/runtime/device connectivity la bat buoc.

## Review Checklist

- Roles covered: Visitor, Viewer, Operator, Admin, System Worker, Mobile MCP Bridge, Scheduler.
- Each role has Co the, Khong the, Khi loi.
- Scope creep blocked: marketplace, billing, production credential vault, social network, anti-bot guarantee, Laixi/iOS unverified claims, infinite artifact scale.
- Strongest verified use case: Android Mobile MCP workflow orchestration on real device.
- Main conditional areas: social platform proof, Laixi live proof, iOS Portal proof, server-side credential boundary, larger fleet SLA.
