# Project Overview PDR

Date: 2026-05-05

## Problem
Operators need a durable way to define, run, monitor, and audit Android automation workflows across connected devices.

## Users
- Admins manage users, devices, and platform setup.
- Operators run workflows and recover device issues.
- Viewers inspect runs, artifacts, and audit logs.

## Core Capabilities
- Device inventory and health.
- Device group management.
- Macro library and versions.
- Backend-owned workflow runs.
- Approval gates for sensitive steps.
- Run monitor and artifact evidence.
- Audit logs.
- Mobile MCP real-device execution.

## Current Pilot Definition
Pilot readiness is measured against Mobile MCP unless Laixi is explicitly promoted to pilot backend.

## Success Metrics
- Preflight passes from current workstation.
- Full Mobile MCP verify passes with expected serial.
- Clean run completes with screenshot artifact.
- Missing-device failure gives actionable diagnostics.

## Unresolved Questions
- Is Laixi required before pilot?
- Which workflow should become first formal Spec Kit feature?
