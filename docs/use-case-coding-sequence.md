# Use Case Coding Sequence

Tai lieu nay chia viec code theo tung nhom role/flow. Moi luot chi duoc implement scope cua luot do, sau do phai tu kiem coverage truoc khi chuyen sang luot tiep theo.

Nguon su that:

- `docs/use-cases.md`
- `docs/use-cases-architecture-spec.md`

## Nguyen tac trien khai

- Code theo role/flow, khong code tat ca use cases trong mot lan.
- Moi luot phai co danh sach use case da cover, anti-use case da enforce, error case da handle.
- Moi anti-use case phai co rule trong code: route guard, permission check, validation, RLS policy, service guard, hoac worker guard.
- Moi error case phai co handling cu the: inline error, toast, job failed state, audit log, retry policy, timeout, hoac conflict handling.
- Khong them feature nam ngoai `He thong KHONG lam` va out-of-scope guardrails trong architecture spec.
- Khong qua luot tiep theo neu luot hien tai chua co coverage report.

## Luot 0: Traceability va permission foundation

Muc tieu: tao nen mong cho cac luot sau enforce dung use case ID, role va permission.

### Implement

- Chuan hoa role constants: `viewer`, `operator`, `admin`, va system actors neu can trong service layer.
- Chuan hoa permission helpers theo matrix trong architecture spec.
- Them guard helpers de check route/action permission o frontend va service/API layer.
- Tao convention comment/test name theo ID: `VIS-CAN-001`, `VIEW-NO-003`, `OP-ERR-007`.

### Khong lam

- Khong build UI moi cho tung role.
- Khong them workflow/device/account behavior moi.
- Khong sua business flow ngoai cac guard/helper dung chung.

### Kiem coverage sau luot

- Foundation nao da san sang de map use case ID vao test/guard?
- Permission nao co helper, permission nao con dang inline?
- Co them thu gi khong xuat phat tu use cases khong?

## Luot 1: Visitor flow

Muc tieu: nguoi chua login chi thay duoc public/auth surface va khong cham duoc internal app.

### Cover

- Can: `VIS-CAN-001` den `VIS-CAN-004`
- Cannot: `VIS-NO-001` den `VIS-NO-004`
- Error: `VIS-ERR-001` den `VIS-ERR-004`

### Implement

- Auth/public routes: login, register neu app co dang ky, forgot password neu dang ton tai.
- Redirect/route guard cho toan bo internal routes.
- Role assignment guard: visitor khong tu gan role.
- Auth error display: sai credential, email da ton tai, session expired, network failure.

### Khong lam

- Khong implement viewer/operator/admin screen trong luot nay.
- Khong them marketplace, billing, social feature, hay automation demo ngoai scope.

### Verification

- Visitor vao internal route bi redirect.
- Visitor login sai thay loi ro rang.
- Visitor khong goi duoc internal actions.
- Session expired thi quay ve auth flow.

## Luot 2: Viewer read-only flow

Muc tieu: viewer doc duoc he thong nhung khong tao/sua/chay/phe duyet/thay doi quyen.

### Cover

- Can: `VIEW-CAN-001` den `VIEW-CAN-008`
- Cannot: `VIEW-NO-001` den `VIEW-NO-008`
- Error: `VIEW-ERR-001` den `VIEW-ERR-005`

### Implement

- Read-only access cho dashboard, devices, macros, runs, approvals, accounts, insights, docs.
- UI disable/an action hide cho create, edit, cancel, approve, reject, credential change, role change.
- Service guard/RLS de viewer khong bypass duoc UI.
- Empty state va unauthorized state cho viewer.

### Khong lam

- Khong cho viewer tao workflow run, macro, account, schedule.
- Khong cho viewer xem secret/token plaintext.

### Verification

- Viewer doc duoc cac trang read-only.
- Viewer action mutation bi chan o UI va service/API.
- Missing record, unauthorized, loading failure deu co handling.

## Luot 3: Operator account va social operation setup

Muc tieu: operator quan ly account inventory va chuan bi run dung dieu kien.

### Cover

- Can: `OP-CAN-001` den `OP-CAN-005`, `OP-CAN-010` den `OP-CAN-013`
- Cannot: `OP-NO-005`, `OP-NO-006`, `OP-NO-009`
- Error: `OP-ERR-001` den `OP-ERR-005`

### Implement

- Account CRUD trong pham vi duoc phep.
- Import account bang CSV voi validation tung dong.
- Credential encryption/decryption flow theo key env hien co.
- Account health, proxy/session/cookie status neu da co model.
- Preflight trong run wizard: account required, healthy, budget not exceeded, platform supported.

### Khong lam

- Khong hien password/token plaintext cho operator.
- Khong auto-login bang production credential ngoai safe stored flow.
- Khong them billing/payment hay marketplace.

### Verification

- CSV loi dong nao bao dong do.
- Duplicate account bi chan.
- Missing encryption key fail-closed.
- Account bi disabled/budget exceeded khong duoc dua vao run.

## Luot 4: Operator device, macro va run control

Muc tieu: operator tao/chay/giam sat workflow tren device va macro trong pham vi duoc phep.

### Cover

- Can: `OP-CAN-006` den `OP-CAN-009`, `OP-CAN-014` den `OP-CAN-020`
- Cannot: `OP-NO-001` den `OP-NO-004`, `OP-NO-007`, `OP-NO-008`
- Error: `OP-ERR-006` den `OP-ERR-013`

### Implement

- Device inventory, device setup, device group/lock awareness.
- Macro create/edit/version/publish flow trong quyen operator.
- Workflow run create/start/pause/cancel/retry tu macro version da publish.
- Run steps, artifacts, screenshot/log links neu da co backend support.
- Approval handoff cho consequential steps.

### Khong lam

- Khong cho operator sua device/macro/run khong thuoc scope.
- Khong bypass approval cho consequential action.
- Khong sua audit log.

### Verification

- Device offline, lock conflict, unsupported platform, stale macro version deu co handling.
- Run cancellation/retry ghi dung state.
- Approval required thi run dung lai va resume dung sau approve.

## Luot 5: Scheduler flow

Muc tieu: schedule chi trigger workflow hop le, dung permission, dung concurrency va co retry/backoff an toan.

### Cover

- Can: `SCH-CAN-001` den `SCH-CAN-004`
- Cannot: `SCH-NO-001` den `SCH-NO-004`
- Error: `SCH-ERR-001` den `SCH-ERR-004`

### Implement

- Schedule CRUD neu nam trong product surface hien co.
- Cron/timezone validation.
- Scheduler trigger guard: active schedule, published macro, allowed actor, account/device preflight.
- Duplicate fire/concurrency guard.

### Khong lam

- Khong auto-sua macro/device/account de chay schedule.
- Khong retry vo han.

### Verification

- Invalid cron/timezone bi tu choi.
- Schedule disable khong trigger.
- Concurrent schedule khong tao duplicate run trai phep.

## Luot 6: Admin governance flow

Muc tieu: admin quan tri users, role, execution profiles, device/account policy va audit ma khong pha guardrails.

### Cover

- Can: `AD-CAN-001` den `AD-CAN-010`
- Cannot: `AD-NO-001` den `AD-NO-007`
- Error: `AD-ERR-001` den `AD-ERR-006`

### Implement

- User/role management voi self-demotion protection.
- Execution profile management.
- Device/account policy management.
- Audit log viewer va immutable audit enforcement.
- Admin delete/archive flows co dependency/conflict checks.

### Khong lam

- Khong cho admin sua/xoa audit log.
- Khong cho admin truy cap secret plaintext.
- Khong xoa record dang duoc run/schedule phu thuoc neu chua resolve dependency.

### Verification

- Admin khong tu khoa role cuoi cung.
- Role update conflict co thong bao.
- Audit log append-only.
- Delete co dependency bi chan hoac yeu cau archive.

## Luot 7: System Worker flow

Muc tieu: worker thuc thi run dung state machine, permission, locks, budget va audit.

### Cover

- Can: `WORK-CAN-001` den `WORK-CAN-012`
- Cannot: `WORK-NO-001` den `WORK-NO-006`
- Error: `WORK-ERR-001` den `WORK-ERR-007`

### Implement

- Claim run/step atomic.
- Device lock acquire/release.
- Step execution state transitions.
- Approval pause/resume enforcement.
- Artifact write, budget tracking, audit log append.
- Timeout, retryable vs terminal error handling.

### Khong lam

- Khong chay step khi actor khong co permission.
- Khong chay consequential action khi chua approve.
- Khong bo qua device/account health.

### Verification

- Two workers khong claim cung step.
- Worker crash/timeout de lai state recoverable.
- Unsupported action fail voi message ro.

## Luot 8: Mobile MCP Bridge flow

Muc tieu: bridge chi nhan session hop le, chi thao tac dung device/platform va tra ve artifact/status ro rang.

### Cover

- Can: `BR-CAN-001` den `BR-CAN-007`
- Cannot: `BR-NO-001` den `BR-NO-005`
- Error: `BR-ERR-001` den `BR-ERR-006`

### Implement

- Bridge token/session validation.
- Device serial/platform validation.
- ADB/Portal capability routing theo platform.
- App/package validation.
- Screenshot/log/error artifact handling.

### Khong lam

- Khong allow insecure bridge by default.
- Khong thao tac device khac serial/request scope.
- Khong mo Portal setup ngoai opt-in.

### Verification

- Missing/invalid token bi chan.
- Device disconnect tra error co the retry.
- Unsupported platform fail som.
- Screenshot/log failure khong lam mat run state.

## Luot 9: Out-of-scope guardrails va final coverage

Muc tieu: dam bao code khong sinh them feature ngoai MVP va moi use case co dau vet enforcement.

### Cover

- Out-of-scope: `OOS-001` den `OOS-016`
- Cross-check all can/cannot/error IDs trong architecture spec.

### Implement

- Remove/hide accidental UI entrypoints ngoai scope neu co.
- Add comments/tests/guards cho nhung guardrail de bi nham.
- Final traceability table update.

### Khong lam

- Khong them feature moi trong luot final.
- Khong refactor lon neu khong can de enforce use cases.

### Verification

- Moi use case co status: `covered`, `partial`, hoac `not covered`.
- Moi anti-use case co rule link.
- Moi error case co validation/handling link.
- Moi plan item co nguon tu use cases hoac duoc danh dau foundation can thiet.

## Mau coverage report sau moi luot

Sau moi luot, phai tra loi theo format nay:

```md
## Coverage Report: Luot X - <ten luot>

### Da cover
- <USE-CASE-ID>: <file/guard/test bang chung>

### Chua cover
- <USE-CASE-ID>: <ly do, se xu ly o luot nao>

### Anti-use case da enforce
- <ANTI-ID>: <rule trong code>

### Error case da handle
- <ERR-ID>: <validation/handling>

### Phat hien moi
- <neu co>

### Test/verify da chay
- <command hoac manual device evidence>

### Ket luan
- Du dieu kien qua luot tiep theo: Co/Khong
```

## Thu tu khuyen nghi

1. Luot 0: Traceability va permission foundation
2. Luot 1: Visitor flow
3. Luot 2: Viewer read-only flow
4. Luot 3: Operator account va social operation setup
5. Luot 4: Operator device, macro va run control
6. Luot 5: Scheduler flow
7. Luot 6: Admin governance flow
8. Luot 7: System Worker flow
9. Luot 8: Mobile MCP Bridge flow
10. Luot 9: Out-of-scope guardrails va final coverage

