# Project Overview PDR

Date: 2026-07-08

## Problem
Operators need a durable way to define, run, monitor, and audit device automation workflows — specifically for **social media automation** teams managing 5-50 Android/iOS devices running Instagram, TikTok, and Facebook accounts.

## Users
- **Social media automation teams** — Run engagement, publishing, and account management workflows across fleets of devices
- Admins manage users, devices, and platform setup.
- Operators run workflows and recover device issues.
- Viewers inspect runs, artifacts, and audit logs.

## Core Capabilities
- Device inventory and health.
- Device group management.
- Macro library and versions (including social macro templates).
- Backend-owned workflow runs.
- Approval gates for sensitive steps.
- Run monitor and artifact evidence.
- Audit logs.
- Mobile MCP real-device execution (Android ADB + iOS Portal).
- **Anti-detection engine** (random delays, scroll variance, device fingerprinting).
- **Account lifecycle tracking** (warm-up stages, action limits, block detection, failover).

## Current Pilot Definition
Pilot readiness is measured against Mobile MCP with Mobilerun AndroidDriver/IOSDriver. Social automation is the primary use case.

Current Level 1 proof is Mobile MCP Android serial `97249fb5` / model `25053RT47C`. First social pilot run `a414e519-c1ac-44df-b287-e91e845f0084` completed with screenshot artifact `c741ceb8-0cba-4096-ad02-b107878f4dbd`; readiness report `76e0141b-2e23-475c-97ea-d4214d50d3d3` is `pilot_verified`.

Level 1 readiness evidence expires 14 days after `verified_at`. Verification must also be rerun before `pilot_verified` if the pilot device, runtime backend, bridge token/auth mode, Supabase project, or workflow proof changes.

## Success Metrics
- Preflight passes from current workstation.
- Full Mobile MCP verify passes with expected serial.
- Clean run completes with screenshot artifact.
- Missing-device failure gives actionable diagnostics.
- **Level 1 social run**: Instagram open/capture completes on a real Android device with screenshot artifact and account action history.
- **Scale social runs**: 5-device Instagram like-automation completes without bot detection.
- **Anti-detection verified**: Random delay variation 3-8s per run; device fingerprint changes per execution.
- **Account tracking accurate**: Action counts correct, warm-up stage advances, daily limits enforced.

## Unresolved Questions
- Instagram/TikTok API vs UI automation for initial accounts?
- Encrypted password storage or OAuth tokens?
- What warm-up sequence is conservative enough to avoid detection?
- When will Laixi VIP/API access be available for clean-path proof?
