# Feature Specification: Credential Storage Boundary

Date: 2026-07-07
Status: draft

## Purpose

Define what credential handling is allowed during pilot and what must remain out of scope until a production credential boundary is built.

## Boundary Decision

Pilot may store encrypted social account password payloads only when `VITE_ACCOUNT_PASSWORD_KEY` is configured and validation passes.

This is still a pilot-only browser-side encryption boundary. It is not a production credential vault.

Production social credentials require a later server-side encryption/key-management spec before scale.

## In Scope

- Social account password input for pilot accounts.
- Client-side encryption using the existing account password helper.
- Blocking saves when the configured key is missing or too weak.
- Never displaying plaintext password after save.
- Scrubbing secret-like fields from readiness evidence and reports.
- Admin-visible credential risk status without plaintext access.

## Out Of Scope

- Production-grade credential vault.
- Server-side decrypt workflow.
- OAuth/session-cookie management.
- Secret rotation that re-encrypts existing account credentials.
- Password recovery or reveal.
- Sharing credentials outside the workspace.

## Data Model

Use existing account credential fields where available:

- `accounts.encrypted_password` or equivalent encrypted payload.
- `accounts.platform`.
- `accounts.username`.
- `accounts.status` / blocked fields.
- `audit_logs` for create/update credential events without secret values.

If future implementation needs explicit policy status, add:

- `credential_policy_status`: `missing_key`, `pilot_client_encrypted`, `server_managed_required`, `unknown`.
- `credential_updated_at`.
- `credential_last_rotated_at`.

Do not add plaintext password columns.

## Permissions

| Role | Permissions |
| --- | --- |
| Visitor | No credential access. |
| Viewer | Can see non-secret account metadata only. |
| Operator | Can create/import/update pilot account credentials when policy allows. |
| Admin | Can see credential risk status and audit metadata, not plaintext. |
| System Worker | Cannot decrypt production credentials; may use only the pilot-compatible execution boundary already implemented. |

## Routes And Endpoints

Use existing routes where possible:

- `/accounts`: create/import/update pilot account credentials.
- `/admin/users` or future admin governance surface: inspect credential risk status if implemented.
- Readiness report review surface: show scrub status, not secrets.

No route may expose plaintext password.

## Use Cases

### Operator Can

- La operator, toi co the luu pilot social account credential neu encryption key hop le.
- La operator, toi co the import CSV co password de tao encrypted pilot payload.
- La operator, toi co the thay the credential bang gia tri moi ma khong xem lai plaintext cu.

### Operator Cannot

- La operator, toi KHONG THE luu password khi `VITE_ACCOUNT_PASSWORD_KEY` thieu hoac qua ngan.
- La operator, toi KHONG THE xem plaintext password sau khi da luu.
- La operator, toi KHONG THE export credential plaintext qua report, artifact, audit log, hoac CSV.

### Admin Can

- La admin, toi co the xem credential risk status cua workspace/account.
- La admin, toi co the thay audit event credential changed ma khong thay secret.

### Admin Cannot

- La admin, toi KHONG THE doc plaintext social password trong UI.
- La admin, toi KHONG THE coi pilot browser encryption la production credential vault.

### Error Cases

- Khi encryption key thieu, save/import phai fail voi message ro.
- Khi encryption key qua ngan/invalid, save/import phai fail truoc khi ghi DB.
- Khi readiness evidence co field secret/token/password/apiKey, system phai scrub truoc khi luu.
- Khi decrypt fail trong pilot boundary, UI/worker phai bao credential unavailable thay vi expose payload.

## Acceptance Criteria

- Credential save/import is blocked without valid key.
- Stored credential payload is not plaintext.
- Account list/detail never renders plaintext password.
- Reports/artifacts scrub secret-like fields.
- Admin risk status does not include secret values.
- Docs and UI copy call this pilot-only, not production vault.

## Verification

- Unit test for encryption key validation.
- Unit test for no plaintext storage in account helper.
- Unit test for readiness evidence secret scrubbing.
- Manual or scripted output showing failed save without key and successful encrypted save with key.
