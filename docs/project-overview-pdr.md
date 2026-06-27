# Project Overview PDR

Date: 2026-06-27

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

## Success Metrics
- Preflight passes from current workstation.
- Full Mobile MCP verify passes with expected serial.
- Clean run completes with screenshot artifact.
- Missing-device failure gives actionable diagnostics.
- **Social runs**: 5-device Instagram like-automation completes without bot detection.
- **Anti-detection verified**: Random delay variation 3-8s per run; device fingerprint changes per execution.
- **Account tracking accurate**: Action counts correct, warm-up stage advances, daily limits enforced.

## Unresolved Questions
- Instagram/TikTok API vs UI automation for initial accounts?
- Encrypted password storage or OAuth tokens?
- What warm-up sequence is conservative enough to avoid detection?
- When will Laixi VIP/API access be available for clean-path proof?
