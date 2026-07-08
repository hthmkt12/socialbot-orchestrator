# Feature Specification: Artifact Retention And Object Storage

Date: 2026-07-07
Status: draft

## Purpose

Define how pilot evidence artifacts are stored, previewed, retained, and moved out of inline database rows when they exceed MVP limits.

## Storage Decision

Small structured outputs may remain inline during pilot.

Large screenshots, large logs, binary payloads, and long-retention evidence must use object storage before the product claims higher-volume readiness.

## In Scope

- Run step outputs.
- Screenshots and visual evidence.
- Readiness report evidence references.
- Inline preview limits.
- Storage mode labels.
- Retention policy for pilot evidence.

## Out Of Scope

- External customer export package.
- Unlimited audit retention.
- Billing-based storage tiers.
- Marketplace template assets.
- Public artifact sharing.

## Data Model

Use existing artifact fields where available.

Required conceptual fields:

- `artifact_ref`
- `artifact_kind`: `screenshot`, `log`, `json`, `html`, `text`, `binary`
- `storage_mode`: `inline`, `object_storage`, `external_ref`, `omitted`
- `content_type`
- `byte_size`
- `preview_json`
- `storage_path`
- `retention_expires_at`
- `redaction_status`: `not_needed`, `scrubbed`, `blocked`

If no artifact table exists for a field, store only a reference in run step output/error metadata.

## Default Limits

Pilot defaults:

- Inline JSON/text preview maximum: 64 KB.
- Inline screenshot/base64 payload: not allowed by default.
- Screenshot artifact: object storage or external reference.
- Readiness evidence retention: 30 days.
- Run debug artifact retention: 14 days.
- Audit metadata retention: follows audit log policy, but does not include large payload.

These values are defaults for the spec. Implementation may make them configurable only inside admin-approved bounds.

## Permissions

| Role | Permissions |
| --- | --- |
| Visitor | No access. |
| Viewer | Read permitted artifact previews/metadata only. |
| Operator | Create artifacts through runs and view permitted evidence. |
| Admin | Configure retention/storage mode inside MVP bounds and review readiness evidence. |
| System Worker | Writes artifacts according to threshold policy. |

## Routes And Endpoints

Use existing routes where possible:

- `/runs/:id`: artifact previews and metadata.
- `/readiness-reports`: evidence references.
- Future admin policy screen only if configuration is implemented.

No public artifact route is allowed.

## Use Cases

### Operator Can

- La operator, toi co the xem screenshot/log/json artifact evidence cua run neu RLS cho phep.
- La operator, toi co the thay metadata khi preview qua lon hoac khong doc duoc.
- La operator, toi co the dung artifact evidence trong readiness report ma khong chen secret.

### Operator Cannot

- La operator, toi KHONG THE luu payload lon vo han trong inline DB row.
- La operator, toi KHONG THE expose secret/token/password qua artifact preview.
- La operator, toi KHONG THE tao public share link cho artifact trong MVP.

### Admin Can

- La admin, toi co the cau hinh retention/storage policy trong gioi han MVP.
- La admin, toi co the review artifact metadata va redaction status.

### Admin Cannot

- La admin, toi KHONG THE cau hinh inline DB retention vo han cho large artifacts.
- La admin, toi KHONG THE bypass redaction blocker de mark readiness verified.

### System Worker Can

- La system worker, toi co the store small structured output inline.
- La system worker, toi co the omit or externalize large payload theo threshold policy.
- La system worker, toi co the persist metadata when preview payload is omitted.

### System Worker Cannot

- La system worker, toi KHONG THE insert large screenshot/base64 payload inline by default.
- La system worker, toi KHONG THE mark redaction passed khi secret-like field con ton tai.

### Error Cases

- Khi artifact vuot inline limit, system stores metadata and object/external reference instead of inline payload.
- Khi object storage upload fails, step records artifact warning/failure with reason.
- Khi preview parse fails, UI shows artifact metadata and safe error message.
- Khi artifact expired, UI shows expired/not available state.
- Khi redaction blocked, readiness verification cannot pass.

## Acceptance Criteria

- Artifact storage mode is explicit.
- Large payloads are not written inline by default.
- Preview fallback never crashes run detail.
- Retention expiry is visible or derivable for readiness evidence.
- Secret-like fields are scrubbed or blocked before readiness verification.
- No public artifact sharing exists in MVP.

## Verification

- Unit test for inline threshold decision.
- Unit test for redaction blocker.
- UI/service test for artifact preview fallback.
- Scripted output showing small inline artifact, large omitted/object artifact metadata, and expired artifact handling when test data permits.
